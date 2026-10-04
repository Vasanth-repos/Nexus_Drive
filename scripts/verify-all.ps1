$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$java17 = 'C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot'
if (-not $env:JAVA_HOME -and (Test-Path -LiteralPath $java17)) { $env:JAVA_HOME = $java17 }
if (-not $env:JAVA_HOME) { throw 'JAVA_HOME must point to a Java 17 JDK.' }
& docker version | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Docker is required for the end-to-end integration test.' }
Push-Location $projectRoot
try {
    & .\mvnw.cmd clean verify -Pintegration
    if ($LASTEXITCODE -ne 0) { throw "Maven verification failed with exit code $LASTEXITCODE." }
} finally {
    Pop-Location
}
