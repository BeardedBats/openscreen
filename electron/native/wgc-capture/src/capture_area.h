#pragma once
#include <cmath>
#include <d3d11.h>

struct CaptureAreaPixels { unsigned left = 0, top = 0, width = 0, height = 0; };
// Round inward. Chroma alignment must never add excluded browser pixels.
inline bool resolveCaptureArea(double x, double y, double w, double h,
                               int sourceWidth, int sourceHeight, CaptureAreaPixels& out) {
    if (!std::isfinite(x) || !std::isfinite(y) || !std::isfinite(w) || !std::isfinite(h) ||
        x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > 1.000001 || y + h > 1.000001 ||
        sourceWidth < 2 || sourceHeight < 2) return false;
    const int left = static_cast<int>(std::ceil(x * sourceWidth));
    const int top = static_cast<int>(std::ceil(y * sourceHeight));
    const int right = static_cast<int>(std::floor((x + w) * sourceWidth));
    const int bottom = static_cast<int>(std::floor((y + h) * sourceHeight));
    const int width = ((right - left) / 2) * 2;
    const int height = ((bottom - top) / 2) * 2;
    if (width < 2 || height < 2 || right > sourceWidth || bottom > sourceHeight) return false;
    out = {static_cast<unsigned>(left), static_cast<unsigned>(top), static_cast<unsigned>(width), static_cast<unsigned>(height)};
    return true;
}

inline void copyCapturedFrame(ID3D11DeviceContext* context, ID3D11Texture2D* destination,
                              ID3D11Texture2D* source, const CaptureAreaPixels* area) {
    if (area) {
        const D3D11_BOX box{area->left, area->top, 0, area->left + area->width, area->top + area->height, 1};
        context->CopySubresourceRegion(destination, 0, 0, 0, 0, source, 0, &box);
    } else {
        context->CopyResource(destination, source);
    }
}
