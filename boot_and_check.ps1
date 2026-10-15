$cwd   = $PSScriptRoot
$py    = Join-Path $cwd 'venv\Scripts\python.exe'
$bot   = Join-Path $cwd 'sreymara-bot\bot.py'
$log   = Join-Path $cwd 'probe_boot.log'
$err   = Join-Path $cwd 'probe_boot.err'

"=== probe_boot STARTED at $(Get-Date) ===" | Out-File -Append -Encoding ascii $log

# Launch bot (unbuffered) in the background; stdout/stderr -> probe logs.
Start-Process -FilePath $py -ArgumentList @('-u', $bot)
              -RedirectStandardOutput $log -RedirectStandardError $err -NoNewWindow -PassThru |
  Out-File -Append -Encoding ascii $log

Start-Sleep -Seconds 10

"=== STDOUT (tail 40) ===" | Out-File -Append -Encoding ascii $log
Get-Content $log -Tail 40 2>$null | Out-File -Append -Encoding ascii $log
"=== STDERR (tail 40) ===" | Out-File -Append -Encoding ascii $log
Get-Content $err -Tail 40 2>$null | Out-File -Append -Encoding ascii $log

"=== LISTENING ON 8080 ===" | Out-File -Append -Encoding ascii $log
netstat -an 2>$null | Select-String ':8080' | Select-String 'LISTENING' -SimpleMatch |
  Format-Table -AutoSize -OutputStream $log

$p = Get-Process -Name python -ErrorAction SilentlyContinue |
     Where-Object { $_.Path -like "*bot.py" -or $_.Path -like "*sreymara-bot*" }
if ($p) {
    Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
    "Stopped probe python process(es): $($p.Id -join ', ')" | Out-File -Append -Encoding ascii $log
}

"=== PROBE DONE ===" | Out-File -Append -Encoding ascii $log
