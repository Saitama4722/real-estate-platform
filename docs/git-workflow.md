# Git Workflow

## Purpose

This document defines the Git workflow rules for the project.

The project uses stage-based development. Each completed stage must be recorded in the Git repository.

## Commit Rules

When a FULL development stage is completed, the following actions must be performed:

1. Update documentation if needed
2. Update README.md if the project status changed
3. Stage all changes
4. Create a commit
5. Push changes to GitHub

## Commit Format

Commit messages must follow this format:

Stage X: short description of the stage

Example:

Stage 1: project foundation completed

Stage 2: backend foundation initialized

Stage 3: core backend modules implemented

## Commands Used

git add .
git commit -m "Stage X: description"
git push
