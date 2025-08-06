# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a study assignment management system that integrates Discord, web interfaces, and AI evaluation. The system uses 6-character alphanumeric assignment IDs for all operations.

## Architecture

### Core Components
- **Discord Bot**: Primary interface for students to submit assignments and check feedback
- **Admin Web Interface**: Dashboard for creating assignments, monitoring submissions, and managing feedback
- **AI Evaluation System**: Automated feedback generation using Claude or OpenAI APIs
- **Database**: Stores assignments, submissions, feedback, and user data

### Key Features
- Assignment submission via Discord commands
- Automated AI-powered code review and feedback
- Real-time submission status tracking
- Admin analytics and monitoring
- Integration with GitHub, Notion APIs

## Development Commands

Since this project is in the planning phase, no build/test commands exist yet. When implementing:
- Set up the appropriate package manager (npm/yarn for Node.js or pip/poetry for Python)
- Configure linting and testing frameworks based on chosen language
- Implement the database schema defined in plan.md

## Database Schema

The system uses these main tables (see plan.md for full schema):
- `assignments`: Stores assignment metadata with unique 6-character IDs
- `submissions`: Student submission records linked to assignments
- `feedbacks`: AI and manual feedback for submissions
- `users`: Student information and Discord IDs

## Discord Bot Commands

Key commands to implement:
- `/submit [assignment_id] [github_link]`: Submit assignment
- `/feedback [assignment_id]`: Check feedback status
- `/status [assignment_id]`: View submission status
- `/help`: Show available commands

## Important Implementation Notes

1. **Assignment IDs**: Always use 6-character alphanumeric codes (e.g., ABC123)
2. **Submission Validation**: Check GitHub repository accessibility before accepting
3. **AI Integration**: Handle API rate limits and errors gracefully
4. **Security**: Never expose API keys or database credentials
5. **Korean Language**: Primary interface language is Korean as specified in plan.md

## Project Status

Currently in planning phase. The plan.md file contains comprehensive specifications in Korean that should be referenced when implementing any component.