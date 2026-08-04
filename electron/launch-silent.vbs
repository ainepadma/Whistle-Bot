Option Explicit

Dim shell, fileSystem, appDirectory, electronCommand
Set shell = CreateObject("WScript.Shell")
Set fileSystem = CreateObject("Scripting.FileSystemObject")

appDirectory = fileSystem.GetParentFolderName(WScript.ScriptFullName)
electronCommand = """" & appDirectory & "\node_modules\.bin\electron.cmd"" ."

shell.CurrentDirectory = appDirectory
shell.Run electronCommand, 0, False
