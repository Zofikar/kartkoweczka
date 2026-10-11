param([string]$Output = '.agents/memory/debug/omr-benchmark.json')
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$process = [System.Diagnostics.Process]::new()
$process.StartInfo.FileName = (Get-Command node).Source
$process.StartInfo.WorkingDirectory = $root
$process.StartInfo.UseShellExecute = $false
# Pin before measurement begins. Initialization/compilation are excluded from samples.
$process.StartInfo.Arguments = "--no-enable-avx --no-enable-avx2 scripts/omr-offline-benchmark.mjs openOmr/build/capture-fixtures `"$Output`""
[void]$process.Start()
$process.ProcessorAffinity = [IntPtr]1
if ($process.ProcessorAffinity -ne [IntPtr]1) { throw 'Single-core affinity failed' }
$process.WaitForExit()
if ($process.ExitCode -ne 0) { throw "Benchmark failed: $($process.ExitCode)" }
