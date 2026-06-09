; Custom NSIS additions for Plex Desktop.
;
; Relabel the installer's primary "Install" button to "Update" when an existing
; installation is detected. electron-builder exposes ${isUpdated} (true when a
; prior version is present). The directory page is declared before customHeader,
; so we set its SHOW callback via customWelcomePage (inserted earlier) and define
; the callback function in customHeader.

; (WM_SETTEXT is provided by WinMessages.nsh, which MUI2 pulls in.)

; Inserted before the directory page — register our show callback for it.
!macro customWelcomePage
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW PlexRelabelPrimaryButton
!macroend

!macro customHeader
  ; Only the installer references this (the uninstaller shares customHeader but
  ; doesn't insert customWelcomePage, so defining it there is an unused-fn error).
  !ifndef BUILD_UNINSTALLER
    Function PlexRelabelPrimaryButton
      ${if} ${isUpdated}
        ; Button id 1 is the wizard's default (Next/Install) button.
        GetDlgItem $0 $HWNDPARENT 1
        SendMessage $0 ${WM_SETTEXT} 0 "STR:Update"
      ${endif}
    FunctionEnd
  !endif
!macroend
