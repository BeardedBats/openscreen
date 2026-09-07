#pragma once
#include <windows.h>
#include <dwmapi.h>
#include <objbase.h>
#include <oleauto.h>
#include <UIAutomation.h>
#include <wrl/client.h>
#include <algorithm>
#include <iostream>
#include <string>

// Read geometry only. Never read webpage text, URLs, or invoke browser controls.
inline int detectBrowserArea(HWND hwnd) {
    using Microsoft::WRL::ComPtr;
    auto unavailable = [] { std::cout << "{\"area\":null}" << std::endl; return 0; };
    if (!IsWindow(hwnd) || IsIconic(hwnd)) return unavailable();
    DWORD pid = 0; GetWindowThreadProcessId(hwnd, &pid);
    HANDLE process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid);
    wchar_t path[32768]; DWORD length = 32768;
    bool gotPath = process && QueryFullProcessImageNameW(process, 0, path, &length);
    if (process) CloseHandle(process);
    if (!gotPath) return unavailable();
    std::wstring name(path, length);
    name = name.substr(name.find_last_of(L"\\/") + 1);
    std::transform(name.begin(), name.end(), name.begin(), towlower);
    if (name != L"chrome.exe" && name != L"msedge.exe" && name != L"firefox.exe" &&
        name != L"brave.exe" && name != L"vivaldi.exe" && name != L"opera.exe" && name != L"arc.exe")
        return unavailable();
    RECT frame{};
    if (FAILED(DwmGetWindowAttribute(hwnd, DWMWA_EXTENDED_FRAME_BOUNDS, &frame, sizeof(frame))))
        return unavailable();
    const double width = frame.right-frame.left, height = frame.bottom-frame.top;
    if (width <= 0 || height <= 0) return unavailable();
    ComPtr<IUIAutomation> automation;
    if (FAILED(CoCreateInstance(CLSID_CUIAutomation, nullptr, CLSCTX_INPROC_SERVER,
                                IID_PPV_ARGS(&automation)))) return unavailable();
    ComPtr<IUIAutomationElement> root;
    if (FAILED(automation->ElementFromHandle(hwnd, &root))) return unavailable();
    VARIANT value{}; value.vt = VT_I4; value.lVal = UIA_DocumentControlTypeId;
    ComPtr<IUIAutomationCondition> condition;
    automation->CreatePropertyCondition(UIA_ControlTypePropertyId, value, &condition);
    if (!condition) return unavailable();
    ComPtr<IUIAutomationElementArray> documents;
    if (FAILED(root->FindAll(TreeScope_Descendants, condition.Get(), &documents))) return unavailable();
    int count = 0; documents->get_Length(&count);
    RECT page{}; long long largest = 0;
    ComPtr<IUIAutomationElement> document;
    for (int i=0; i<count; ++i) {
        ComPtr<IUIAutomationElement> candidate; documents->GetElement(i, &candidate);
        BOOL offscreen=TRUE; RECT r{};
        if (!candidate || FAILED(candidate->get_CurrentIsOffscreen(&offscreen)) || offscreen ||
            FAILED(candidate->get_CurrentBoundingRectangle(&r))) continue;
        if (r.left < frame.left || r.top < frame.top || r.right > frame.right || r.bottom > frame.bottom) continue;
        long long size = static_cast<long long>(r.right-r.left)*(r.bottom-r.top);
        if (size > largest) { largest=size; page=r; document=candidate; }
    }
    if (!document || largest < width*height*0.2) return unavailable();
    // Remove only long scrollbars on the document's outer edges. Nested table scrollbars remain intact.
    value.lVal=UIA_ScrollBarControlTypeId;
    condition.Reset(); automation->CreatePropertyCondition(UIA_ControlTypePropertyId, value, &condition);
    ComPtr<IUIAutomationElementArray> bars;
    int removed=0;
    if (condition && SUCCEEDED(document->FindAll(TreeScope_Descendants, condition.Get(), &bars))) {
        bars->get_Length(&count);
        const RECT original=page;
        for (int i=0; i<count; ++i) {
            ComPtr<IUIAutomationElement> bar; bars->GetElement(i,&bar);
            BOOL hidden=TRUE; RECT r{};
            if (!bar || FAILED(bar->get_CurrentIsOffscreen(&hidden)) || hidden || FAILED(bar->get_CurrentBoundingRectangle(&r))) continue;
            const LONG w=r.right-r.left, h=r.bottom-r.top;
            if (w>0 && w<=40 && h>(original.bottom-original.top)*0.75 &&
                r.top>=original.top && r.bottom<=original.bottom &&
                r.left>=original.left && r.right<=original.right && abs(r.right-original.right)<=2) {
                page.right=std::min(page.right,r.left); ++removed;
            }
            if (h>0 && h<=40 && w>(original.right-original.left)*0.75 &&
                r.left>=original.left && r.right<=original.right &&
                r.top>=original.top && r.bottom<=original.bottom && abs(r.bottom-original.bottom)<=2) {
                page.bottom=std::min(page.bottom,r.top); ++removed;
            }
        }
    }
    std::cout << "{\"area\":{\"x\":" << (page.left-frame.left)/width
              << ",\"y\":" << (page.top-frame.top)/height
              << ",\"width\":" << (page.right-page.left)/width
              << ",\"height\":" << (page.bottom-page.top)/height
              << "},\"scrollbarsRemoved\":" << removed << "}" << std::endl;
    return 0;
}
