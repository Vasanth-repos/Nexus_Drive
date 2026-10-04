$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$java = 'C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot\bin\java.exe'
if (-not (Test-Path -LiteralPath $java)) { throw 'Java 17 JDK not found at the expected path.' }
$run = Join-Path $root '.e2e\run'
New-Item -ItemType Directory -Force -Path $run | Out-Null
$processes = [System.Collections.Generic.List[System.Diagnostics.Process]]::new()
$occupied = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -in 8080,8081,9001,9002,9003 }
if ($occupied) { throw "NexusDrive ports are already occupied: $($occupied.LocalPort -join ',')" }

function Start-NexusProcess([string]$name, [string]$jar, [hashtable]$variables) {
    $info = [System.Diagnostics.ProcessStartInfo]::new()
    $info.FileName = $java
    $log = Join-Path $run "$name.log"
    $info.Arguments = "-jar `"$jar`" --logging.file.name=`"$log`""
    $info.WorkingDirectory = $root
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardOutput = $false
    $info.RedirectStandardError = $false
    foreach ($entry in $variables.GetEnumerator()) { $info.EnvironmentVariables[$entry.Key] = [string]$entry.Value }
    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $info
    if (-not $process.Start()) { throw "Failed to start $name" }
    $processes.Add($process)
    return $process
}

function Wait-Healthy([string]$url) {
    $deadline = [DateTime]::UtcNow.AddMinutes(2)
    do {
        try { if ((Invoke-WebRequest -UseBasicParsing $url -TimeoutSec 3).StatusCode -eq 200) { return } } catch { Start-Sleep -Milliseconds 500 }
    } while ([DateTime]::UtcNow -lt $deadline)
    throw "Service did not become healthy: $url"
}

$jwt = 'local-e2e-jwt-secret-at-least-thirty-two-bytes'
$storageSecret = 'local-e2e-storage-secret-long-enough'
$master = 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8='
$commonStorage = @{ STORAGE_INTERNAL_SECRET=$storageSecret; REPLICATION_FACTOR='3' }

try {
    Start-NexusProcess 'storage-1' (Join-Path $root 'storage-node\target\storage-node-1.0.0.jar') ($commonStorage + @{SERVER_PORT='9001';NODE_ID='node-1';STORAGE_PATH=(Join-Path $run 'storage1');PEERS='127.0.0.1:9002,127.0.0.1:9003'}) | Out-Null
    Start-NexusProcess 'storage-2' (Join-Path $root 'storage-node\target\storage-node-1.0.0.jar') ($commonStorage + @{SERVER_PORT='9002';NODE_ID='node-2';STORAGE_PATH=(Join-Path $run 'storage2');PEERS='127.0.0.1:9001,127.0.0.1:9003'}) | Out-Null
    Start-NexusProcess 'storage-3' (Join-Path $root 'storage-node\target\storage-node-1.0.0.jar') ($commonStorage + @{SERVER_PORT='9003';NODE_ID='node-3';STORAGE_PATH=(Join-Path $run 'storage3');PEERS='127.0.0.1:9001,127.0.0.1:9002'}) | Out-Null
    9001..9003 | ForEach-Object { Wait-Healthy "http://127.0.0.1:$_/actuator/health" }
    $probeHeaders = @{'X-Storage-Secret'=$storageSecret;'X-Replication-Request'='true'}
    Invoke-RestMethod -Method Put -Uri 'http://127.0.0.1:9001/chunks/e2e-auth-probe' -Headers $probeHeaders -ContentType 'application/octet-stream' -Body ([byte[]](1,2,3)) | Out-Null
    Invoke-RestMethod -Method Delete -Uri 'http://127.0.0.1:9001/chunks/e2e-auth-probe' -Headers $probeHeaders | Out-Null
    Start-NexusProcess 'auth' (Join-Path $root 'auth-service\target\auth-service-1.0.0.jar') @{SERVER_PORT='8080';JWT_SECRET=$jwt;DB_URL='jdbc:postgresql://127.0.0.1:55432/nexusdrive';DB_USER='nexusdrive';DB_PASSWORD=''} | Out-Null
    Wait-Healthy 'http://127.0.0.1:8080/actuator/health'
    Start-NexusProcess 'metadata' (Join-Path $root 'metadata-service\target\metadata-service-1.0.0.jar') @{SERVER_PORT='8081';JWT_SECRET=$jwt;DB_URL='jdbc:postgresql://127.0.0.1:55432/nexusdrive';DB_USER='nexusdrive';DB_PASSWORD='';STORAGE_NODES='127.0.0.1:9001,127.0.0.1:9002,127.0.0.1:9003';STORAGE_INTERNAL_SECRET=$storageSecret;ENCRYPTION_MASTER_KEY=$master} | Out-Null
    Wait-Healthy 'http://127.0.0.1:8081/actuator/health'

    $suffix = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $credentials = @{username="flow$suffix";email="flow$suffix@example.com";password='correct-horse-battery-staple'}
    Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8080/api/auth/register' -ContentType 'application/json' -Body ($credentials | ConvertTo-Json) | Out-Null
    $login = Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8080/api/auth/login' -ContentType 'application/json' -Body (@{username=$credentials.username;password=$credentials.password} | ConvertTo-Json)
    $headers = @{Authorization="Bearer $($login.data.accessToken)"}
    $payload = [Text.Encoding]::UTF8.GetBytes('NexusDrive local end-to-end payload')
    $upload = Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8081/api/files/upload' -Headers $headers -ContentType 'application/json' -Body (@{filename='flow.txt';mimeType='text/plain';sizeBytes=$payload.Length;tags=@('integration')} | ConvertTo-Json)
    $fileId = $upload.data.id
    Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8081/api/files/$fileId/chunks/0" -Headers $headers -ContentType 'application/octet-stream' -Body $payload | Out-Null
    $download = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:8081/api/files/$fileId/download" -Headers $headers
    $downloadText = if ($download.Content -is [byte[]]) { [Text.Encoding]::UTF8.GetString($download.Content) } else { [string]$download.Content }
    if ($downloadText -ne [Text.Encoding]::UTF8.GetString($payload)) { throw 'Downloaded payload mismatch' }
    Start-Sleep -Seconds 2
    $replicaCounts = 1..3 | ForEach-Object { @(Get-ChildItem -LiteralPath (Join-Path $run "storage$_") -Filter '*.chunk' -ErrorAction SilentlyContinue).Count }
    if (($replicaCounts | Where-Object { $_ -lt 1 }).Count -gt 0) { throw "Replication verification failed: $replicaCounts" }
    Invoke-RestMethod -Method Delete -Uri "http://127.0.0.1:8081/api/files/$fileId" -Headers $headers | Out-Null
    $cleanupDeadline = [DateTime]::UtcNow.AddSeconds(45)
    do {
        $remaining = 1..3 | ForEach-Object { Test-Path -LiteralPath (Join-Path $run "storage$_\$fileId-0.chunk") }
        if (-not ($remaining -contains $true)) { break }
        Start-Sleep -Seconds 1
    } while ([DateTime]::UtcNow -lt $cleanupDeadline)
    if ($remaining -contains $true) { throw "Physical cleanup did not remove $fileId from all replicas" }
    Write-Output "PASS fileId=$fileId replicas=$($replicaCounts -join ',')"
} finally {
    foreach ($process in $processes) { if (-not $process.HasExited) { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue; $process.WaitForExit(10000) | Out-Null }; $process.Dispose() }
}
