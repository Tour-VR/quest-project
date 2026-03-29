#!/usr/bin/bash

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

trap 'echo -e "${RED}[PANIC] Script aborted abnormally at line $LINENO"' ERR

echo "${YELLOW}[INFO] starting the configuration of the enviroment for SSH"

echo "${NC}[PROC] changing global config to SSH instead of HTTPS"
if git config --global url."git@github.com:".insteadOf "https://github.com/"; then
    echo "${GREEN}[SUC] Successfully changed the global configuration"
else
    echo "${RED}[ERR] Failed in modyfing your configuration"
    echo "${NC}[INFO] Program exited with exit code 1"
    exit 1 # 1 because trash bash doesn't allow -1 exit code, and we all learned the correct way is to exit negative
fi


echo "${NC}[PROC] testing SSH connection..."
if ssh -T git@github.com 2>&1 | grep -q "successfully authenticated"; then # why the hell github returns success to stderr? I don't care, SVN is better anyways
    echo "${GREEN}[SUC] SSH connection working successfully!"
else
    echo "${RED}[ERR] SSH connection failed, this could happen to wrong configuration"
    echo "${YELLOW}[INFO] Try to check your SSH key or generate one if you still don't have with: ssh-keygen -t ed25519"
    echo "${YELLOW}[INFO] Also check your SSH key status on Github"
    echo "${NC}[INFO] Program exited with exit code 1"
    exit 1
fi

echo "${NC}[PROC] syncronizing submodules..." # why would anyone use this? Unfortunately support is required
git submodule sync --recursive

echo "${NC}[PROC] updating submodules..."
git submodule update --init --recursive

echo "${NC}[PROC] cleaning remote HTTPS URLs..."
git remote -v | grep https://github.com > /dev/null 2>&1 &&
    {
        CURRENT_URL=$(git remote get-url origin)
        SSH_URL=$(echo "$CURRENT_URL" | sed 's#https://github.com/#git@github.com:#')
        git remote set-url origin "$SSH_URL"
        echo "${GREEN}[SUC] origin updated to SSH"
    }

echo ""
echo "${GREEN}[SUC] setup was executed successfully"
echo "${YELLOW}[INFO] you can now use SSH instead of HTTPS, enjoy your time with the correct way to manage github"
echo "${NC}[INFO] Setup finished with exit code 0"
exit 0
