Set-Location "C:\dev\workspace\jace-s"

function GcloudPids { (Get-Process gcloud -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id) -join "," }

function RunTest([string]$Name, [scriptblock]$Cmd) {
  $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"
  Write-Host "===================="
  Write-Host "$ts  TEST: $Name"
  Write-Host "$ts  PWD:  $(Get-Location)"
  Write-Host "$ts  gcloud PIDs (before): $(GcloudPids)"
  $out = & $Cmd 2>&1 | Out-String
  Write-Host "----- output (start) -----"
  Write-Host $out
  Write-Host "----- output (end) -----"
  $hit = $out -match "gcloud crashed|Errno 22|flushing sys\.stdout"
  $ts2 = Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"
  Write-Host "$ts2  gcloud error pattern detected?: $hit"
  Write-Host "$ts2  gcloud PIDs (after):  $(GcloudPids)"
}

RunTest "A) PowerShell -> npm run docker:build:prod" { npm run docker:build:prod }
RunTest "B) cmd.exe /c npm run docker:build:prod" { cmd.exe /c "npm run docker:build:prod" }
RunTest "C) cmd.exe /c npm run docker:build:prod > build.redirect.log 2>&1" { 
  cmd.exe /c "npm run docker:build:prod > build.redirect.log 2>&1"
  Get-Content .\build.redirect.log -Raw
}
