!macro NSIS_HOOK_POSTINSTALL
  Delete "$DESKTOP\coolapk-desktop.lnk"
  CreateShortCut "$DESKTOP\酷安.lnk" "$INSTDIR\coolapk-desktop.exe"
  Delete "$SMPROGRAMS\coolapk-desktop\coolapk-desktop.lnk"
  CreateDirectory "$SMPROGRAMS\酷安"
  CreateShortCut "$SMPROGRAMS\酷安\酷安.lnk" "$INSTDIR\coolapk-desktop.exe"
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  Delete "$DESKTOP\酷安.lnk"
  RMDir /r "$SMPROGRAMS\酷安"
!macroend
