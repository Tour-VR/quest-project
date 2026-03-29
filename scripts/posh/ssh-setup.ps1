# PowerShell doesn't have trap for line numbers natively, Microsoft fix your shell
$ErrorActionPreference = "Stop"

function Write-Info   { param($msg) Write-Host "[INFO] $msg" -ForegroundColor Yellow }
function Write-Proc   { param($msg) Write-Host "[PROC] $msg" -ForegroundColor White }
function Write-Suc    { param($msg) Write-Host "[SUC] $msg"  -ForegroundColor Green }
function Write-Err    { param($msg) Write-Host "[ERR] $msg"  -ForegroundColor Red }
function Write-Panic  { param($msg) Write-Host "[PANIC] $msg" -ForegroundColor Red }

# PowerShell's version of bash's trap 'ERR', again Microsoft, fix your shell
try {

    Write-Info "starting the configuration of the enviroment for SSH"

    Write-Proc "changing global config to SSH instead of HTTPS"
    try {
        git config --global url."git@github.com:".insteadOf "https://github.com/"
        if ($LASTEXITCODE -ne 0) { throw "git config returned exit code $LASTEXITCODE" }
        Write-Suc "Successfully changed the global configuration"
    } catch {
        Write-Err "Failed in modyfing your configuration"
        Write-Host "[INFO] Program exited with exit code 1" -ForegroundColor White
        exit -1 # Atleast allows negative return errors, finally something good this shell gives you
    }

    Write-Proc "testing SSH connection..."
    # Already told you about this nonsense on bash version, won't say again
    $sshOutput = ssh -T git@github.com 2>&1
    if ($sshOutput -match "successfully authenticated") {
        Write-Suc "SSH connection working successfully!"
    } else {
        Write-Err "SSH connection failed, this could happen to wrong configuration"
        Write-Info "Try to check your SSH key or generate one if you still don't have with: ssh-keygen -t ed25519"
        Write-Info "Also check your SSH key status on Github"
        Write-Host "[INFO] Program exited with exit code 1" -ForegroundColor White
        exit -1
    }

    Write-Proc "syncronizing submodules..." # If you use submodules, please stop, just make organized folders, Dennis Ritchie would be ashamed of you
    git submodule sync --recursive

    Write-Proc "updating submodules..."
    git submodule update --init --recursive

    Write-Proc "cleaning remote HTTPS URLs..."
    $remotes = git remote -v
    if ($remotes -match "https://github.com") {
        $currentUrl = git remote get-url origin
        # PowerShell's -replace operator uses regex, I already told Microsoft to fix this shell? Bring batch again, atleast it does things right
        $sshUrl = $currentUrl -replace "https://github.com/", "git@github.com:"
        git remote set-url origin $sshUrl
        Write-Suc "origin updated to SSH"
    }

    Write-Host ""
    Write-Suc "setup was executed successfully"
    Write-Info "you can now use SSH instead of HTTPS, enjoy your time with the correct way to manage github"
    Write-Host "[INFO] Setup finished with exit code 0" -ForegroundColor White
    exit 0

} catch {
    # Closest we can get to bash's trap 'ERR' - no $LINENO in PowerShell, unfortunately, that is why you should use Linux
    Write-Panic "Script aborted abnormally: $_"
    exit -1
}