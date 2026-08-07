!macro customInstall
  CreateShortCut "$DESKTOP\酷安.lnk" "$INSTDIR\coolapk-desktop.exe"
  Delete "$DESKTOP\coolapk-desktop.lnk"
!macroend

!macro customUnInstall
  Delete "$DESKTOP\酷安.lnk"
!macroend
