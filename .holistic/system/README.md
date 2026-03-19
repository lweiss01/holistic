# Holistic System Setup

This directory contains generated startup and sync helpers for Holistic.

Files:
- run-daemon.ps1 / run-daemon.sh: restore the portable state, then start the background daemon
- restore-state.ps1 / restore-state.sh: pull the portable Holistic state branch into the current worktree when safe
- sync-state.ps1 / sync-state.sh: push the current branch and mirror Holistic files into the dedicated state branch
- config in ../config.json defines the remote and portable state branch
