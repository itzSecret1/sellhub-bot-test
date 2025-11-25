# SellAuth Discord Bot

## Overview
The SellAuth Discord Bot is a production-ready, highly stable Discord bot designed to manage product stock, automate item replacement, and synchronize product variants with the SellAuth platform. The bot provides comprehensive automation, professional staff notifications, weekly reporting, daily backups, and intelligent moderation. It offers staff and administrators essential tools for efficient inventory management with advanced logging, robust error handling, and automated recovery systems to ensure reliability and security.

## User Preferences
I prefer clear, concise, and structured explanations. Focus on high-level decisions and their impact. For coding, prioritize robust error handling, security, and maintainability. When making changes, ensure comprehensive logging is in place and that the system remains stable and performant. I prefer to be informed about critical bug fixes and architectural changes.

## Recent Audit & Fixes (November 25, 2025)

### NEW: Comprehensive Automation Suite - Professional Features (Session 7)
**Features Implemented:** 7 major new automated systems and commands

#### 1. **Multi-Language Translation Command** (`/translate`)
- Translate any message to 15+ languages (Spanish, French, Russian, German, Italian, Portuguese, Japanese, Chinese, Korean, Arabic, Hindi, Polish, Dutch, Turkish, English)
- Beautiful Discord embed output with original + translated text
- Supports long messages with graceful truncation
- **Usage:** `/translate message:(text) language:(choose from dropdown)`

#### 2. **Server Dashboard Command** (`/dashboard`)
- Real-time server statistics (members, channels, roles, transactions)
- Bot uptime and performance metrics
- Quick command reference
- Interactive buttons for extended stats
- **Usage:** `/dashboard`

#### 3. **Weekly Automated Reports** (`WeeklyReporter.js`)
- Scheduled every Monday at **09:00 UTC**
- Sends professional embed to channel **1442913019788001513**
- Reports total transactions, success rate, bot status, recommendations
- Persistent scheduling (survives bot restarts)

#### 4. **Daily Automated Backups** (`DailyBackupReporter.js`)
- Scheduled daily at **03:00 UTC**
- Backups all critical files: variantsData.json, replaceHistory.json, sessionState.json
- Stores backups in `/backups` directory with ISO timestamps
- Sends detailed backup confirmation to channel **1442913427575013426**
- Easy recovery system for data restoration

#### 5. **Auto-Moderation System** (`AutoModerator.js`)
- Automatically detects Discord server invites in messages
- Deletes rule-violating messages instantly
- Sends warning to violating user via DM
- Logs all moderation actions to channel **1442913855964450901**
- Excludes bot owners/admins from moderation
- Reports: user, channel, invites found, timestamp, action taken

#### 6. **Hourly Auto-Sync Scheduler** (`AutoSync.js`)
- Automatically syncs product variants **every 60 minutes**
- No manual intervention required
- Tracks sync duration and logs all operations
- Graceful error handling with fallback

#### 7. **Daily Status Updates** (Enhanced)
- Sends status confirmation to staff channel **1441496193711472814** at **12:00 UTC daily**
- Shows uptime, commands available, security status
- Green embed when online, Red embed when offline with recovery time

---

### Integration Architecture

**Automated System Timeline (UTC):**
```
03:00 UTC - Daily Backups created → Channel 1442913427575013426
09:00 UTC (Mondays) - Weekly Reports → Channel 1442913019788001513  
12:00 UTC Daily - Status Updates → Channel 1441496193711472814
18:33:44 UTC (Nov 25) - Bot Auto-Reconnects → All systems activate
Every 60 minutes - Auto-Sync variants (background)
Continuous - Auto-Moderation running
```

**Error Handling:**
- All systems gracefully handle errors
- Failed backups reported to staff
- Missing channels logged but don't crash systems
- Connection failures trigger auto-recovery

**Data Persistence:**
- All scheduled tasks survive bot restarts
- State tracked in: sessionState.json, connectionState.json, replaceHistory.json
- Backups stored in: backups/ directory with ISO 8601 timestamps

---

### Previous Systems (Session 5-6)

**Connection Rate Limiter** (`ConnectionManager.js`)
- Max 2 connection attempts per minute
- 30-second minimum between attempts
- Automatic 2-minute cooldown on rate limit hits
- Prevents cascading session blocks

**Session Recovery Manager** (`SessionRecoveryManager.js`)
- Detects Discord session limit errors
- Extracts exact reset time from Discord
- Schedules automatic reconnection
- Zero manual intervention

**Professional Status Notifications** (`StatusReporter.js`)
- Offline notifications with reconnection time
- Daily online confirmations
- Beautiful Discord embeds with professional formatting

---

## System Architecture
The bot operates with a modular command-based structure where each command is an independent module. It includes:
- **Core `Bot.js` class** for Discord integration and system initialization
- **`Api.js` class** for SellAuth API interactions
- **Advanced `AdvancedCommandLogger`** for detailed command tracking
- **`errorLogger`** for robust error monitoring
- **Multiple automated reporter systems** for staff notifications
- **Auto-moderation** for rule enforcement
- **Persistent state management** for recovery and reliability

## Feature Specifications

### Core Commands
- `/stock` - View and extract product stock
- `/replace` - Automate item replacement
- `/unreplace` - Undo replacements
- `/sync-variants` - Synchronize product variants
- `/invoice-view` - View detailed invoice information
- `/balance-add` - Add customer balance (admin only)
- `/balance-remove` - Remove customer balance (admin only)
- `/clear` - Bulk delete messages (admin only)
- `/backup` - Create server backup (admin only)
- `/loadbackup` - Restore server backup (admin only)
- `/listbackup` - List all available backups (admin only)
- `/audit` - View comprehensive audit logs (admin only)
- `/config` - Manage server settings
- `/status` - System performance monitoring
- `/role-info` - Role statistics and information
- `/help` - Command help and documentation

### New Automated Features
- **`/translate`** - Multi-language translation (15+ languages)
- **`/dashboard`** - Real-time server statistics and status
- **Weekly Reports** - Automated Monday 09:00 UTC to channel 1442913019788001513
- **Daily Backups** - Automated 03:00 UTC to channel 1442913427575013426
- **Daily Status** - Automated 12:00 UTC to channel 1441496193711472814
- **Auto-Sync** - Every 60 minutes (background)
- **Auto-Moderation** - Continuous with logging to channel 1442913855964450901

### Advanced Security & Monitoring
- **Rate limiting** with automatic user isolation
- **Permission validation** before sensitive operations
- **Error monitoring** with automatic logging
- **Auto-recovery** for Discord session limits
- **Professional audit logging** with timestamps
- **Role protection system** against unauthorized changes
- **Anti-spam system** with professional response throttling

---

## System Design Choices
- **Modular Architecture:** Commands and systems isolated for scalability
- **Centralized API Client:** `Api.js` handles all SellAuth interactions
- **Robust Error Handling:** Comprehensive error coverage with graceful fallbacks
- **Persistent Storage:** JSON files for state, scheduled tasks, and recovery
- **Professional Formatting:** Discord embeds for all user-facing output
- **Automated Systems:** Scheduled tasks with zero manual intervention
- **Logging:** Detailed logging to both console and Discord channels
- **Rate Limiting:** Connection and API request throttling
- **Session Recovery:** Automatic bot recovery without manual intervention
- **Moderation:** Automated rule enforcement with staff visibility

---

## External Dependencies
- **Discord API:** For bot interactions, commands, and messaging
- **SellAuth API:** For product, stock, and invoice data management
- **Google Translate API:** For multi-language translation (@vitalets/google-translate-api)
- **Railway:** Cloud platform for continuous deployment
- **GitHub:** Version control and source code management
