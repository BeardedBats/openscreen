#include "capture_area.h"
#include <wrl/client.h>
#include <iostream>
#include <limits>
using Microsoft::WRL::ComPtr;
int main() {
    CaptureAreaPixels area{};
    if (!resolveCaptureArea(0, .5, 1, .5, 4, 4, area) || area.top != 2 || area.width != 4 || area.height != 2) return 1;
    CaptureAreaPixels odd{};
    if (!resolveCaptureArea(.1, .1, .8, .8, 101, 101, odd) || odd.left != 11 || odd.top != 11 || odd.width != 78) return 2;
    if (resolveCaptureArea(-.1, 0, 1, 1, 100, 100, odd)) return 3;
    if (resolveCaptureArea(.5, 0, 1, 1, 100, 100, odd)) return 4;
    if (resolveCaptureArea(0, 0, .001, 1, 100, 100, odd)) return 5;
    if (resolveCaptureArea(std::numeric_limits<double>::quiet_NaN(), 0, 1, 1, 100, 100, odd)) return 6;
    ComPtr<ID3D11Device> device;
    ComPtr<ID3D11DeviceContext> context;
    if (FAILED(D3D11CreateDevice(nullptr, D3D_DRIVER_TYPE_WARP, nullptr, 0, nullptr, 0, D3D11_SDK_VERSION, &device, nullptr, &context))) return 7;
    // Excluded toolbar rows are red. The chosen webpage rows are blue.
    const unsigned pixels[16] = {0xffff0000,0xffff0000,0xffff0000,0xffff0000,0xffff0000,0xffff0000,0xffff0000,0xffff0000,
                                0xff0000ff,0xff0000ff,0xff0000ff,0xff0000ff,0xff0000ff,0xff0000ff,0xff0000ff,0xff0000ff};
    D3D11_TEXTURE2D_DESC desc{};
    desc.Width=4; desc.Height=4; desc.MipLevels=1; desc.ArraySize=1; desc.Format=DXGI_FORMAT_B8G8R8A8_UNORM; desc.SampleDesc.Count=1;
    D3D11_SUBRESOURCE_DATA initial{pixels,16,0};
    ComPtr<ID3D11Texture2D> source, destination;
    if (FAILED(device->CreateTexture2D(&desc, &initial, &source))) return 8;
    desc.Height=2; desc.Usage=D3D11_USAGE_STAGING; desc.CPUAccessFlags=D3D11_CPU_ACCESS_READ;
    if (FAILED(device->CreateTexture2D(&desc, nullptr, &destination))) return 9;
    copyCapturedFrame(context.Get(), destination.Get(), source.Get(), &area);
    D3D11_MAPPED_SUBRESOURCE mapped{};
    if (FAILED(context->Map(destination.Get(), 0, D3D11_MAP_READ, 0, &mapped))) return 10;
    bool clean=true;
    for (unsigned y=0;y<2;y++) {
        auto row=reinterpret_cast<const unsigned*>(static_cast<const unsigned char*>(mapped.pData)+y*mapped.RowPitch);
        for (unsigned x=0;x<4;x++) clean=clean && row[x]==0xff0000ff;
    }
    context->Unmap(destination.Get(),0);
    if (!clean) return 11;
    std::cout << "Capture area: bounds, inward rounding, invalid inputs, and native GPU pixel exclusion passed." << std::endl;
    return 0;
}
