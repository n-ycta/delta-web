param([switch]$Open, [switch]$WithOptional, [switch]$ApproveDependencies)
$ErrorActionPreference='Stop'
$tmp=Join-Path ([IO.Path]::GetTempPath()) (([guid]::NewGuid().ToString())+'.ps1')
try { Invoke-WebRequest https://raw.githubusercontent.com/n-ycta/delta/main/install.ps1 -OutFile $tmp; & $tmp -Plugins 'storage,web' -Open:$Open -WithOptional:$WithOptional -ApproveDependencies:$ApproveDependencies } finally { Remove-Item $tmp -Force -ErrorAction SilentlyContinue }
