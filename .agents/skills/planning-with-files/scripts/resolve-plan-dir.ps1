# planning-with-files: resolve active plan directory (PowerShell mirror).
#
# Resolution order matches scripts/resolve-plan-dir.sh:
#   1. $env:PLAN_ID -> .\.planning\$PLAN_ID\
#   2. .\.planning\.active_plan content
#   3. Newest .\.planning\<dir>\ by LastWriteTime
#   4. Empty (legacy fallback to .\task_plan.md handled by caller)

param(
    [string]$PlanRoot = (Join-Path (Get-Location) ".planning")
)

$activeFile = Join-Path $PlanRoot ".active_plan"

function Test-PlanId {
    param([string]$Value)
    return ($Value -match '^[A-Za-z0-9_][A-Za-z0-9._-]*$')
}

if ($env:PLAN_ID) {
    $planId = $env:PLAN_ID
    if ((Test-PlanId $planId)) {
        $candidate = Join-Path $PlanRoot $planId
    }
    if ($candidate -and (Test-Path -LiteralPath $candidate -PathType Container)) {
        Write-Output $candidate
        exit 0
    }
}

if (Test-Path -LiteralPath $activeFile) {
    $planId = (Get-Content -LiteralPath $activeFile -Raw) -replace '[\r\n\s]', ''
    if ((Test-PlanId $planId)) {
        $candidate = Join-Path $PlanRoot $planId
        if (Test-Path -LiteralPath $candidate -PathType Container) {
            Write-Output $candidate
            exit 0
        }
    }
}

if (Test-Path -LiteralPath $PlanRoot -PathType Container) {
    $latest = Get-ChildItem -LiteralPath $PlanRoot -Directory |
        Where-Object { -not $_.Name.StartsWith(".") } |
        Where-Object { Test-PlanId $_.Name } |
        Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName "task_plan.md") } |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    if ($latest) {
        Write-Output $latest.FullName
    }
}

exit 0
