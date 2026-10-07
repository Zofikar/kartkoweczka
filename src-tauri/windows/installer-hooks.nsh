; Security software may temporarily retain a handle after the application exits.
; Do not terminate unrelated processes or services; wait for write access instead.
!macroundef CheckIfAppIsRunning
!macro CheckIfAppIsRunning executablePath productName
  !define KartkoweczkaCheckID ${__LINE__}
  Push $0
  Push $1
  Push $2
  Push $3
  StrCpy $1 0
  kartkoweczka_check_${KartkoweczkaCheckID}:
    IfFileExists "${executablePath}" 0 kartkoweczka_ready_${KartkoweczkaCheckID}
    ; GENERIC_WRITE, share read/write/delete, OPEN_EXISTING. No file is modified.
    ; ?e captures GetLastError inside the plug-in before another call changes it.
    System::Call 'kernel32::CreateFileW(w "${executablePath}", i 0x40000000, i 7, p 0, i 3, i 0, p 0) p .r0 ?e'
    Pop $2
    ${If} $0 != -1
      System::Call 'kernel32::CloseHandle(p r0)'
      Goto kartkoweczka_ready_${KartkoweczkaCheckID}
    ${EndIf}
    ; A file removed between the existence check and open needs no replacement.
    ${If} $2 == 2
      Goto kartkoweczka_ready_${KartkoweczkaCheckID}
    ${EndIf}
    ${If} $2 != 5
    ${AndIf} $2 != 32
      Goto kartkoweczka_failed_${KartkoweczkaCheckID}
    ${EndIf}
    IntOp $1 $1 + 1
    ${If} $1 < 30
      Sleep 1000
      Goto kartkoweczka_check_${KartkoweczkaCheckID}
    ${EndIf}
  kartkoweczka_failed_${KartkoweczkaCheckID}:
    StrCpy $3 "Cannot replace ${productName} (Windows error $2). Close the app and retry. If this persists, check file permissions and security software."
    DetailPrint "${executablePath}: $3"
    IfSilent +2
      MessageBox MB_OK|MB_ICONSTOP "$3"
    Pop $3
    Pop $2
    Pop $1
    Pop $0
    Abort
  kartkoweczka_ready_${KartkoweczkaCheckID}:
    Pop $3
    Pop $2
    Pop $1
    Pop $0
  !undef KartkoweczkaCheckID
!macroend