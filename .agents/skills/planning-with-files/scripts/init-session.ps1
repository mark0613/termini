# Initialize planning files for a new session (PowerShell mirror of init-session.sh).
#
# Usage:
#   .\init-session.ps1                                 # .planning\<date>-untitled-<short>\
#   .\init-session.ps1 -Template TYPE                  # same, with template choice
#   .\init-session.ps1 "Backend Refactor"              # .planning\<date>-backend-refactor\
#   .\init-session.ps1 -PlanDir "Quick Spike"          # explicit slug (-PlanDir kept for compatibility)
#
# Every plan is written under .planning\<date>-<slug>\ and .planning\.active_plan
# is pinned so resolve-plan-dir.ps1 can find it. Without a project name the slug
# falls back to untitled-<short>. This gives default and parallel multi-task runs
# the same directory structure (issue #148).

param(
    [string]$ProjectName = "",
    [string]$Template = "default",
    [switch]$PlanDir  # Retained for backward compatibility; slug mode is now always on.
)

$DATE = Get-Date -Format "yyyy-MM-dd"

# Resolve template directory (skill root is one level up from scripts/)
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SkillRoot = Split-Path -Parent $ScriptDir
$TemplateDir = Join-Path $SkillRoot "templates"

# Validate template
if ($Template -ne "default" -and $Template -ne "analytics") {
    Write-Host "Unknown template: $Template (available: default, analytics). Using default."
    $Template = "default"
}

function Get-Slug {
    param([string]$Text)
    $s = $Text.ToLower()
    $s = [regex]::Replace($s, '[^a-z0-9]', '-')
    $s = [regex]::Replace($s, '-{2,}', '-')
    $s = $s.Trim('-')
    if ($s.Length -gt 40) { $s = $s.Substring(0, 40) }
    return $s
}

function Get-ShortUuid {
    return ([guid]::NewGuid().ToString("N").Substring(0, 8))
}

function Write-DefaultTaskPlan {
    param([string]$Path)
    @"
# Task Plan: [Brief Description]

## Goal
[One sentence describing the end state]

## Current Phase
Phase 1

## Phases

### Phase 1: Requirements & Discovery
- [ ] Understand user intent
- [ ] Identify constraints
- [ ] Document in findings.md
- **Status:** in_progress

### Phase 2: Planning & Structure
- [ ] Define approach
- [ ] Create project structure
- **Status:** pending

### Phase 3: Implementation
- [ ] Execute the plan
- [ ] Write to files before executing
- **Status:** pending

### Phase 4: Testing & Verification
- [ ] Verify requirements met
- [ ] Document test results
- **Status:** pending

### Phase 5: Delivery
- [ ] Review outputs
- [ ] Deliver to user
- **Status:** pending

## Decisions Made
| Decision | Rationale |
|----------|-----------|

## Errors Encountered
| Error | Resolution |
|-------|------------|
"@ | Out-File -FilePath $Path -Encoding UTF8
}

function Write-DefaultFindings {
    param([string]$Path)
    @"
# Findings & Decisions

## Requirements
-

## Research Findings
-

## Technical Decisions
| Decision | Rationale |
|----------|-----------|

## Issues Encountered
| Issue | Resolution |
|-------|------------|

## Resources
-
"@ | Out-File -FilePath $Path -Encoding UTF8
}

function Write-DefaultProgress {
    param([string]$Path)
    @"
# Progress Log

## Session: $DATE

### Current Status
- **Phase:** 1 - Requirements & Discovery
- **Started:** $DATE

### Actions Taken
-

### Test Results
| Test | Expected | Actual | Status |
|------|----------|--------|--------|

### Errors
| Error | Resolution |
|-------|------------|
"@ | Out-File -FilePath $Path -Encoding UTF8
}

function Write-AnalyticsProgress {
    param([string]$Path)
    @"
# Progress Log

## Session: $DATE

### Current Status
- **Phase:** 1 - Data Discovery
- **Started:** $DATE

### Actions Taken
-

### Query Log
| Query | Result Summary | Interpretation |
|-------|---------------|----------------|

### Errors
| Error | Resolution |
|-------|------------|
"@ | Out-File -FilePath $Path -Encoding UTF8
}

function New-PlanFiles {
    param([string]$TargetDir)
    $planPath = Join-Path $TargetDir "task_plan.md"
    $findingsPath = Join-Path $TargetDir "findings.md"
    $progressPath = Join-Path $TargetDir "progress.md"

    if (-not (Test-Path $planPath)) {
        $analyticsPlan = Join-Path $TemplateDir "analytics_task_plan.md"
        if ($Template -eq "analytics" -and (Test-Path $analyticsPlan)) {
            Copy-Item $analyticsPlan $planPath
        } else {
            Write-DefaultTaskPlan $planPath
        }
        Write-Host "Created $planPath"
    } else {
        Write-Host "$planPath already exists, skipping"
    }

    if (-not (Test-Path $findingsPath)) {
        $analyticsFindings = Join-Path $TemplateDir "analytics_findings.md"
        if ($Template -eq "analytics" -and (Test-Path $analyticsFindings)) {
            Copy-Item $analyticsFindings $findingsPath
        } else {
            Write-DefaultFindings $findingsPath
        }
        Write-Host "Created $findingsPath"
    } else {
        Write-Host "$findingsPath already exists, skipping"
    }

    if (-not (Test-Path $progressPath)) {
        if ($Template -eq "analytics") {
            Write-AnalyticsProgress $progressPath
        } else {
            Write-DefaultProgress $progressPath
        }
        Write-Host "Created $progressPath"
    } else {
        Write-Host "$progressPath already exists, skipping"
    }
}

$slug = Get-Slug $ProjectName
if (-not $slug) {
    $slug = "untitled-$(Get-ShortUuid)"
}
$baseId = "$DATE-$slug"
$planId = $baseId
$planRoot = Join-Path (Get-Location) ".planning"
$counter = 2
while (Test-Path (Join-Path $planRoot $planId) -PathType Container) {
    $planId = "$baseId-$counter"
    $counter++
}
$planFolder = Join-Path $planRoot $planId
New-Item -ItemType Directory -Path $planFolder -Force | Out-Null

$displayName = if ($ProjectName) { $ProjectName } else { "untitled" }
Write-Host "Initializing planning files for: $displayName (template: $Template)"
Write-Host "PLAN_ID=$planId"
New-PlanFiles $planFolder
$activeFile = Join-Path $planRoot ".active_plan"
$planId | Out-File -FilePath $activeFile -Encoding UTF8
Write-Host ""
Write-Host "Active plan recorded: $activeFile"
Write-Host "Pin this terminal to the plan for parallel sessions:"
Write-Host "  `$env:PLAN_ID = '$planId'"
