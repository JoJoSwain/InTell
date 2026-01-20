# 🚀 GitHub Setup Instructions

**Your local Git repository is ready! Now let's push it to GitHub.**

---

## ✅ What's Done

- [x] Git repository initialized
- [x] All files committed (149 files, 37,525 lines)
- [x] Sensitive files protected (.gitignore)
- [x] Team documentation created

---

## 📤 Step 1: Create GitHub Repository

### Option A: Via GitHub Website (Recommended)

1. **Go to GitHub**: https://github.com/new
2. **Repository Settings**:
   - **Name**: `ReplacePlace` (or your preferred name)
   - **Description**: `GPS-powered location-based storytelling app for Android`
   - **Visibility**: 
     - **Private** (recommended if you want to keep API keys secure)
     - **Public** (if you want open source)
   - **DO NOT** initialize with README, .gitignore, or license (we already have these!)
3. Click **"Create repository"**

### Option B: Via GitHub CLI

```bash
# Install GitHub CLI: https://cli.github.com/
gh repo create ReplacePlace --private --source=. --remote=origin --push
```

---

## 📡 Step 2: Add Remote and Push

### After creating the repository on GitHub:

```powershell
# Navigate to your project
cd "C:\Users\swainj2399\Replaceplace"

# Add GitHub as remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/ReplacePlace.git

# Verify remote was added
git remote -v

# Push to GitHub
git push -u origin master
```

**Example**:
```powershell
git remote add origin https://github.com/johndoe/ReplacePlace.git
git push -u origin master
```

---

## 🔐 Step 3: Protect Sensitive Data on GitHub

### 3.1 Verify .gitignore Worked

After pushing, check on GitHub that these files are **NOT** visible:

- ❌ `google-services.json` (should NOT be there)
- ❌ `src/constants/config.js` (should NOT be there)
- ❌ `*.keystore` files (should NOT be there)
- ✅ `google-services.example.json` (should be there)
- ✅ `config.example.js` (should be there)

### 3.2 Set Up Repository Secrets (for CI/CD later)

1. Go to your repo → **Settings** → **Secrets and variables** → **Actions**
2. Add these secrets:
   - `FIREBASE_API_KEY`
   - `GOOGLE_MAPS_API_KEY`
   - (Add others as needed)

---

## 👥 Step 4: Invite Team Members

1. Go to your repo → **Settings** → **Collaborators**
2. Click **"Add people"**
3. Enter GitHub usernames or emails
4. Choose access level:
   - **Write**: Can push directly
   - **Admin**: Full control

---

## 📋 Step 5: Set Up Branch Protection (Recommended)

**Protect your main branch from accidental changes:**

1. Go to repo → **Settings** → **Branches**
2. Click **"Add branch protection rule"**
3. **Branch name pattern**: `master` (or `main`)
4. Enable:
   - [x] **Require a pull request before merging**
   - [x] **Require approvals**: 1
   - [x] **Require status checks to pass**
5. Click **"Create"**

This ensures all changes go through pull requests with reviews!

---

## 🔄 Team Workflow After Setup

### For Team Members Cloning the Repo:

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/ReplacePlace.git
cd ReplacePlace

# Follow TEAM_SETUP.md for configuration
# They will need to create their own:
# - google-services.json
# - config.js
# These files are .gitignored for security
```

### Daily Development Workflow:

```bash
# 1. Update your local repository
git pull origin master

# 2. Create a feature branch
git checkout -b feature/your-feature-name

# 3. Make changes and commit
git add .
git commit -m "feat: Add your feature"

# 4. Push to GitHub
git push origin feature/your-feature-name

# 5. Create Pull Request on GitHub
# 6. Get review and merge
```

---

## 🌿 Branch Strategy

```
master (or main)          # Production-ready code
  ├── develop             # Integration branch
  ├── feature/xyz         # New features
  ├── bugfix/xyz          # Bug fixes
  └── hotfix/xyz          # Urgent fixes
```

**Commit Message Format**:
```
feat: Add route recommendations
fix: Resolve GPS crash
docs: Update setup guide
refactor: Simplify API service
test: Add unit tests for GPS
chore: Update dependencies
```

---

## 📊 Useful Git Commands

```bash
# Check status
git status

# View commit history
git log --oneline --graph --decorate --all

# Create and switch to new branch
git checkout -b feature/new-feature

# Switch branches
git checkout master

# Pull latest changes
git pull origin master

# Push changes
git push origin your-branch-name

# View remotes
git remote -v

# View differences
git diff

# Stash changes temporarily
git stash
git stash pop
```

---

## 🔧 Troubleshooting

### "Permission denied" when pushing

**Solution**: Set up SSH keys or use Personal Access Token

**With HTTPS** (use Personal Access Token as password):
1. GitHub → Settings → Developer settings → Personal access tokens
2. Generate new token (classic)
3. Use token as password when pushing

**With SSH**:
```bash
# Generate SSH key
ssh-keygen -t ed25519 -C "your-email@example.com"

# Add to GitHub: Settings → SSH and GPG keys → New SSH key
# Change remote to SSH
git remote set-url origin git@github.com:YOUR_USERNAME/ReplacePlace.git
```

### "! [rejected] master -> master (fetch first)"

**Solution**: Pull first, then push
```bash
git pull origin master --rebase
git push origin master
```

### "Your branch is behind 'origin/master'"

**Solution**: Pull the latest changes
```bash
git pull origin master
```

---

## ✅ Verification Checklist

After setup, verify:

- [ ] Repository created on GitHub
- [ ] Local repo connected to GitHub remote
- [ ] Code pushed successfully
- [ ] Sensitive files NOT visible on GitHub
- [ ] README.md displays correctly
- [ ] Team members can clone the repo
- [ ] Branch protection enabled (if desired)

---

## 🎉 Success!

Your ReplacePlace repository is now on GitHub and ready for team collaboration!

**Next Steps**:
1. Share the repository link with your team
2. Have them follow [TEAM_SETUP.md](TEAM_SETUP.md)
3. Start collaborating with pull requests!

---

## 📚 Additional Resources

- **Git Documentation**: https://git-scm.com/doc
- **GitHub Guides**: https://guides.github.com/
- **Git Branching**: https://learngitbranching.js.org/
- **Pull Request Best Practices**: https://github.com/blog/1943-how-to-write-the-perfect-pull-request

---

**Happy Collaborating!** 🚀👥
