$ErrorActionPreference = "Stop"

$mobileRoot = $PSScriptRoot
$sourceRoot = Resolve-Path (Join-Path $mobileRoot "..")
$targetRoot = Join-Path $mobileRoot "www"

New-Item -ItemType Directory -Force -Path $targetRoot | Out-Null

$filePatterns = @("*.html", "*.css", "*.js")
foreach ($pattern in $filePatterns) {
    Get-ChildItem -Path $sourceRoot -File -Filter $pattern | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination $targetRoot -Force
    }
}

$siteDirectories = @(
    "Achievements",
    "Daily",
    "EarlyRelease",
    "Infinite",
    "Leaderboard",
    "Library",
    "Minigames",
    "Practice",
    "Sharkpass",
    "Story",
    "Updates",
    "shark-rescue"
)

foreach ($directory in $siteDirectories) {
    $sourceDirectory = Join-Path $sourceRoot $directory
    if (Test-Path -LiteralPath $sourceDirectory) {
        Copy-Item -LiteralPath $sourceDirectory -Destination $targetRoot -Recurse -Force
    }
}

$rulesFile = Join-Path $sourceRoot "firestore.rules"
if (Test-Path -LiteralPath $rulesFile) {
    Copy-Item -LiteralPath $rulesFile -Destination $targetRoot -Force
}

$imagesSource = Join-Path $sourceRoot "images"
$imagesTarget = Join-Path $targetRoot "images"
if (Test-Path -LiteralPath $imagesSource) {
    Copy-Item -LiteralPath $imagesSource -Destination $targetRoot -Recurse -Force
}

$mobileCssSource = Join-Path $mobileRoot "mobile.css"
if (Test-Path -LiteralPath $mobileCssSource) {
    Copy-Item -LiteralPath $mobileCssSource -Destination $targetRoot -Force
}

$utf8NoBom = New-Object System.Text.UTF8Encoding $false
$mobileCssLink = '<link rel="stylesheet" href="mobile.css">'
Get-ChildItem -Path $targetRoot -File -Filter "*.html" -Recurse | ForEach-Object {
    $html = [System.IO.File]::ReadAllText($_.FullName, $utf8NoBom)
    if ($html -notmatch [regex]::Escape($mobileCssLink)) {
        $html = [regex]::Replace($html, '</head>', "    $mobileCssLink`r`n</head>", 'IgnoreCase')
        [System.IO.File]::WriteAllText($_.FullName, $html, $utf8NoBom)
    }
}

Write-Host "Copied Sharkdle web files into $targetRoot"
