Unicode true
!include "MUI2.nsh"
Name "Michi Pet"
OutFile "Instalar Michi Pet.exe"
InstallDir "$LOCALAPPDATA\Programs\Michi Pet"
RequestExecutionLevel user
SetCompressor /SOLID lzma
BrandingText "Michi Pet · Michi Apps por Rocío Maure"
VIProductVersion "1.1.0.0"
VIAddVersionKey "ProductName" "Michi Pet"
VIAddVersionKey "FileDescription" "Instalador de Michi Pet"
VIAddVersionKey "CompanyName" "Rocío Maure"
VIAddVersionKey "LegalCopyright" "© 2026 Rocío Maure · MIT"
VIAddVersionKey "FileVersion" "1.1.0"
VIAddVersionKey "ProductVersion" "1.1.0"
!define MUI_ICON "icon.ico"
!define MUI_UNICON "icon.ico"
!define MUI_WELCOMEPAGE_TITLE "Bienvenida a Michi Pet"
!define MUI_WELCOMEPAGE_TEXT "Este asistente va a instalar Michi Pet, un gatito que vive en tu escritorio.$\r$\n$\r$\nVa a pasear por la parte de abajo de tu pantalla, encima de todas las ventanas. Frótalo con el mouse para que ronronee, arrástralo para tomarlo en brazos y haz clic para que maúlle.$\r$\n$\r$\nHaz clic en Siguiente para continuar."
!define MUI_FINISHPAGE_TITLE "Michi Pet ya llegó"
!define MUI_FINISHPAGE_TEXT "Para llamarlo, darle su ovillo, esconderlo o hacer que parta con Windows, busca su carita junto al reloj, en la esquina inferior derecha (si no la ves, haz clic en la flechita ^)."
!define MUI_FINISHPAGE_RUN "$INSTDIR\Michi Pet.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Abrir Michi Pet ahora"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Spanish"

Section "Michi Pet"
  SetOutPath "$INSTDIR"
  File /r "win-unpacked\*.*"
  WriteUninstaller "$INSTDIR\Desinstalar Michi Pet.exe"
  CreateDirectory "$SMPROGRAMS\Michi Pet"
  CreateShortcut "$SMPROGRAMS\Michi Pet\Michi Pet.lnk" "$INSTDIR\Michi Pet.exe" "" "$INSTDIR\icon.ico"
  CreateShortcut "$SMPROGRAMS\Michi Pet\Desinstalar Michi Pet.lnk" "$INSTDIR\Desinstalar Michi Pet.exe"
  CreateShortcut "$DESKTOP\Michi Pet.lnk" "$INSTDIR\Michi Pet.exe" "" "$INSTDIR\icon.ico"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\MichiPet" "DisplayName" "Michi Pet"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\MichiPet" "Publisher" "Rocío Maure"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\MichiPet" "DisplayVersion" "1.1.0"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\MichiPet" "DisplayIcon" "$INSTDIR\icon.ico"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\MichiPet" "UninstallString" '"$INSTDIR\Desinstalar Michi Pet.exe"'
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\MichiPet" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\MichiPet" "NoRepair" 1
SectionEnd

Section "Uninstall"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Michi Pet"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "app.michipet.gatito"
  Delete "$DESKTOP\Michi Pet.lnk"
  RMDir /r "$SMPROGRAMS\Michi Pet"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\MichiPet"
SectionEnd
