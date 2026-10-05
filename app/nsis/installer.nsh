!include WinVer.nsh
!include FileFunc.nsh
Caption "${PRODUCT_NAME} ${VERSION}"

!macro WriteInstallLog Stage
    Push "${Stage}"
    Call AppendInstallLog
!macroend

Function AppendInstallLog
    Exch $R9
    Push $0
    Push $1
    Push $2
    Push $3
    Push $4
    Push $5
    Push $6
    Push $7

    ${GetTime} "" "L" $0 $1 $2 $3 $4 $5 $6
    ClearErrors
    FileOpen $7 "$TEMP\ClaudeNotes-install.log" a
    IfErrors installLogDone
    FileSeek $7 0 END
    FileWrite $7 "$2-$1-$0 $4:$5:$6 $R9$\r$\n"
    FileClose $7

installLogDone:
    ClearErrors
    Pop $7
    Pop $6
    Pop $5
    Pop $4
    Pop $3
    Pop $2
    Pop $1
    Pop $0
    Pop $R9
FunctionEnd

!macro preInit
    SetOutPath "$TEMP"
    ${IfNot} ${AtLeastWin10}
        !insertmacro WriteInstallLog "installer-rejected-unsupported-windows version=${VERSION}"
        MessageBox MB_ICONEXCLAMATION "非常抱歉，ClaudeNotes 无法在低于 Windows 10 的系统上进行安装$\n$\n\
            Sorry, ClaudeNotes cannot be installed on systems below Windows 10$\n"
        Quit
    ${EndIf}

    !insertmacro WriteInstallLog "installer-start version=${VERSION} package=$EXEPATH"
    Push $R8
    Push $R7
    ; 只结束 ClaudeNotes 自己的进程，不影响同时安装的官方思源
    nsExec::Exec '"$SYSDIR\taskkill.exe" /F /IM "ClaudeNotes.exe"'
    Pop $R8
    nsExec::Exec '"$SYSDIR\taskkill.exe" /F /IM "ClaudeNotes-Kernel.exe"'
    Pop $R7
    !insertmacro WriteInstallLog "process-cleanup-complete version=${VERSION} app-result=$R8 kernel-result=$R7"
    Pop $R7
    Pop $R8
!macroend

!macro customInit
    ; 安装目录本身是一个工作空间时拒绝安装，避免程序文件与笔记数据混在一起
    ${If} ${FileExists} "$INSTDIR\conf\conf.json"
    ${OrIf} ${FileExists} "$INSTDIR\data\.siyuan\*.*"
        !insertmacro WriteInstallLog "installer-rejected-workspace-dir version=${VERSION} target=$INSTDIR"
        MessageBox MB_ICONSTOP "所选安装目录 $INSTDIR 是一个笔记工作空间，请选择其他目录。$\n$\n\
            The selected folder $INSTDIR is a notes workspace, please choose another folder.$\n"
        Quit
    ${EndIf}
    !insertmacro WriteInstallLog "installer-ready version=${VERSION} target=$INSTDIR"
!macroend

!macro customInstall
    !insertmacro WriteInstallLog "payload-extracted version=${VERSION} target=$INSTDIR"
    nsExec::ExecToLog '"$SYSDIR\cmd.exe" /c mklink /H "$INSTDIR\resources\kernel\claudenotes.exe" "$INSTDIR\resources\kernel\ClaudeNotes-Kernel.exe" 2>nul || ver>nul'
    ${If} $installMode == "all"
        nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -Command "$k=\"$INSTDIR\resources\kernel\";$p=[Environment]::GetEnvironmentVariable(\"Path\",\"Machine\");if((-not $p) -or -not ($p.Split(\";\") -contains $k)){$p=\"$k;$p\";[Environment]::SetEnvironmentVariable(\"Path\",$p,\"Machine\")}else{Write-Host \"already in PATH\"}"'
    ${Else}
        nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -Command "$k=\"$INSTDIR\resources\kernel\";$p=[Environment]::GetEnvironmentVariable(\"Path\",\"User\");if((-not $p) -or -not ($p.Split(\";\") -contains $k)){$p=\"$k;$p\";[Environment]::SetEnvironmentVariable(\"Path\",$p,\"User\")}else{Write-Host \"already in PATH\"}"'
    ${EndIf}
    !insertmacro WriteInstallLog "install-complete version=${VERSION} target=$INSTDIR"
!macroend

!macro customUnInstall
    ; 卸载（非升级）时询问是否删除安装目录中的笔记与配置，默认保留
    ${IfNot} ${isUpdated}
        IfFileExists "$INSTDIR\ClaudeNotesData\*.*" 0 skipDataDelete
            MessageBox MB_YESNO|MB_DEFBUTTON2 "是否同时删除笔记与配置（$INSTDIR\ClaudeNotesData）？选择「否」将保留这些数据。$\n$\n\
                Do you also want to delete your notes and settings ($INSTDIR\ClaudeNotesData)? Choose No to keep them.$\n" \
                /SD IDNO IDYES AcceptedRMData IDNO SkippedRMData
                AcceptedRMData:
                    RMDir /r "$INSTDIR\ClaudeNotesData"
                    RMDir "$INSTDIR"
                SkippedRMData:
        skipDataDelete:
    ${EndIf}

    ${If} $installMode == "all"
        nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -Command "$k=\"$INSTDIR\resources\kernel\";$p=[Environment]::GetEnvironmentVariable(\"Path\",\"Machine\");if($p){$a=$p.Split(\";\") | ?{$_ -and ($_ -ne $k)};$p=[string]::Join(\";\",$a);[Environment]::SetEnvironmentVariable(\"Path\",$p,\"Machine\")}"'
    ${Else}
        nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -Command "$k=\"$INSTDIR\resources\kernel\";$p=[Environment]::GetEnvironmentVariable(\"Path\",\"User\");if($p){$a=$p.Split(\";\") | ?{$_ -and ($_ -ne $k)};$p=[string]::Join(\";\",$a);[Environment]::SetEnvironmentVariable(\"Path\",$p,\"User\")}"'
    ${EndIf}
!macroend

; 卸载与升级时删除程序文件但保留 ClaudeNotesData（electron-builder 默认会清空整个安装目录）
!macro customRemoveFiles
    ClearErrors
    FindFirst $0 $1 "$INSTDIR\*.*"
    claudeNotesRemoveLoop:
        StrCmp $1 "" claudeNotesRemoveDone
        StrCmp $1 "." claudeNotesRemoveNext
        StrCmp $1 ".." claudeNotesRemoveNext
        StrCmp $1 "ClaudeNotesData" claudeNotesRemoveNext
        IfFileExists "$INSTDIR\$1\*.*" 0 claudeNotesRemoveFile
            RMDir /r "$INSTDIR\$1"
            Goto claudeNotesRemoveNext
        claudeNotesRemoveFile:
            Delete "$INSTDIR\$1"
        claudeNotesRemoveNext:
            ClearErrors
            FindNext $0 $1
            IfErrors claudeNotesRemoveDone claudeNotesRemoveLoop
    claudeNotesRemoveDone:
    FindClose $0
    ; 目录为空（没有 ClaudeNotesData）时一并删除
    RMDir "$INSTDIR"
!macroend

