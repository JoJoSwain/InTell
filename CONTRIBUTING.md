# 🤝 Contributing to ReplacePlace

Thank you for your interest in contributing to ReplacePlace! This document provides guidelines and best practices for contributing to the project.

---

## 📋 Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Workflow](#development-workflow)
4. [Coding Standards](#coding-standards)
5. [Git Guidelines](#git-guidelines)
6. [Pull Request Process](#pull-request-process)
7. [Testing](#testing)
8. [Documentation](#documentation)

---

## 📜 Code of Conduct

- **Be respectful** and professional in all interactions
- **Be patient** with new contributors
- **Be constructive** with feedback
- **Collaborate openly** and transparently
- **Focus on what is best** for the project and community

---

## 🚀 Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally
3. **Follow** the [TEAM_SETUP.md](TEAM_SETUP.md) guide
4. **Create a branch** for your work
5. **Make your changes**
6. **Submit a pull request**

---

## 🔄 Development Workflow

### Branch Strategy

We use **feature branching** with the following structure:

```
main                    # Production-ready code
├── develop            # Integration branch for features
├── feature/xyz        # New features
├── bugfix/xyz         # Bug fixes
├── hotfix/xyz         # Urgent production fixes
└── docs/xyz           # Documentation updates
```

### Branch Naming Conventions

**Format**: `type/short-description`

**Types**:
- `feature/` - New features (e.g., `feature/add-audio-player`)
- `bugfix/` - Bug fixes (e.g., `bugfix/fix-gps-crash`)
- `hotfix/` - Critical production fixes (e.g., `hotfix/api-key-leak`)
- `docs/` - Documentation only (e.g., `docs/update-readme`)
- `refactor/` - Code refactoring (e.g., `refactor/simplify-routing`)
- `test/` - Adding tests (e.g., `test/add-gps-tests`)

**Examples**:
```bash
git checkout -b feature/offline-mode
git checkout -b bugfix/map-marker-crash
git checkout -b docs/api-documentation
```

---

## 💻 Coding Standards

### JavaScript/React Native

**Follow these conventions**:

1. **Use ES6+ syntax**:
   ```javascript
   // ✅ Good
   const userName = 'John';
   const users = users.map(u => u.name);
   
   // ❌ Avoid
   var userName = 'John';
   var names = users.map(function(u) { return u.name; });
   ```

2. **Use functional components with hooks**:
   ```javascript
   // ✅ Good
   export default function HomeScreen({ navigation }) {
     const [locations, setLocations] = useState([]);
     // ...
   }
   
   // ❌ Avoid class components for new code
   class HomeScreen extends Component { }
   ```

3. **Destructure props and state**:
   ```javascript
   // ✅ Good
   const { latitude, longitude } = location.coords;
   
   // ❌ Avoid
   const lat = location.coords.latitude;
   ```

4. **Use async/await for promises**:
   ```javascript
   // ✅ Good
   const data = await fetchLocations();
   
   // ❌ Avoid
   fetchLocations().then(data => { });
   ```

5. **Meaningful variable names**:
   ```javascript
   // ✅ Good
   const userLocation = getCurrentPosition();
   const isLocationUnlocked = checkUnlockStatus();
   
   // ❌ Avoid
   const loc = getCurrentPosition();
   const x = checkUnlockStatus();
   ```

### File Organization

```
src/
├── components/        # Reusable UI components
│   └── RouteOptionsModal.js
├── screens/          # Screen components (one per route)
│   └── HomeScreen.js
├── services/         # Business logic & API calls
│   ├── FirebaseService.js
│   └── RouteService.js
├── constants/        # Configuration & constants
│   └── config.js
└── utils/            # Helper functions
    └── formatDistance.js
```

### Component Structure

```javascript
// 1. Imports (group by: React, libraries, local)
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView from 'react-native-maps';
import APIService from '../services/APIService';

// 2. Component function
export default function ComponentName({ prop1, prop2 }) {
  // 3. State declarations
  const [data, setData] = useState([]);
  
  // 4. Effects
  useEffect(() => {
    loadData();
  }, []);
  
  // 5. Helper functions
  const loadData = async () => {
    // ...
  };
  
  // 6. Render
  return (
    <View style={styles.container}>
      {/* JSX */}
    </View>
  );
}

// 7. Styles (at bottom)
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
```

### Console Logging

Use **consistent emoji prefixes** for logs:

```javascript
console.log('✅ Success:', data);          // Success
console.log('📍 GPS:', latitude);          // GPS/Location
console.log('🗺️ Map:', mapData);           // Map-related
console.log('🔥 Firebase:', response);     // Firebase
console.log('⚠️ Warning:', message);       // Warning
console.error('❌ Error:', error);         // Error
console.log('🔍 Debug:', variable);        // Debug info
```

---

## 🎋 Git Guidelines

### Commit Messages

**Format**: `type: Brief description (50 chars max)`

**Types**:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Formatting, no code change
- `refactor:` - Code restructuring
- `test:` - Adding tests
- `chore:` - Build/config changes

**Examples**:
```bash
feat: Add route recommendations modal
fix: Resolve GPS timeout crash
docs: Update team setup guide
refactor: Simplify location service
test: Add GPS service unit tests
chore: Update expo to 52.0.0
```

**Good commit messages**:
```
✅ feat: Add walking route recommendations
✅ fix: Prevent crash when GPS unavailable
✅ docs: Add GPS testing guide
```

**Bad commit messages**:
```
❌ Update stuff
❌ Fixed bug
❌ Changes
```

### Commit Best Practices

1. **Commit often** - Small, logical chunks
2. **One concern per commit** - Don't mix features and fixes
3. **Test before committing** - Ensure code runs
4. **Write clear messages** - Future you will thank you

---

## 🔀 Pull Request Process

### Before Creating a PR

- [ ] **Pull latest changes** from `develop`
- [ ] **Test your changes** thoroughly
- [ ] **Update documentation** if needed
- [ ] **No sensitive data** (API keys, credentials)
- [ ] **Code follows style guide**
- [ ] **All console errors resolved**

### Creating a Pull Request

1. **Push your branch** to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create PR** on GitHub:
   - Base: `develop` (not `main`)
   - Compare: your feature branch
   
3. **Fill out the PR template**:

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Refactoring

## Testing
- [ ] Tested on Android emulator
- [ ] Tested on physical device
- [ ] GPS functionality verified
- [ ] No console errors

## Screenshots (if UI changes)
[Add screenshots here]

## Checklist
- [ ] Code follows project style guide
- [ ] Documentation updated
- [ ] No sensitive data committed
- [ ] All tests passing
```

### Review Process

1. **At least one approval** required
2. **Address review comments** promptly
3. **Update** based on feedback
4. **Squash commits** if requested (keep history clean)

---

## 🧪 Testing

### Manual Testing Checklist

Before submitting a PR, test:

- [ ] **App loads** without crashing
- [ ] **Login flow** works
- [ ] **Map displays** correctly
- [ ] **GPS tracking** functions
- [ ] **Routes load** when requested
- [ ] **No console errors** or warnings
- [ ] **Works on emulator** and device (if possible)

### GPS Testing

Use these test coordinates in the emulator:

```
Temple Square:   40.7704, -111.8922
Liberty Park:    40.7398, -111.8711
U of Utah:       40.7649, -111.8421
```

See [GPS_TESTING_GUIDE.md](App.js/GPS_TESTING_GUIDE.md) for detailed instructions.

---

## 📚 Documentation

### When to Update Docs

Update documentation when you:

- Add a **new feature** → Update README.md
- Change **setup process** → Update TEAM_SETUP.md
- Modify **API keys/config** → Update setup guides
- Fix a **common issue** → Add to troubleshooting section
- Change **architecture** → Document in code comments

### Documentation Style

- Use **clear headings** with emoji for visual appeal
- Include **code examples** where helpful
- Add **screenshots** for UI changes
- Keep it **concise** but comprehensive
- Use **checklists** for step-by-step processes

---

## 🐛 Reporting Bugs

### Before Reporting

1. **Search existing issues** - May already be reported
2. **Test on latest version** - May already be fixed
3. **Reproduce the bug** - Ensure it's consistent

### Bug Report Template

```markdown
## Bug Description
Clear description of the issue

## Steps to Reproduce
1. Open app
2. Navigate to X
3. Click Y
4. See error

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Environment
- Device: Pixel 7 Emulator
- Android Version: 14
- App Version: 1.0.0

## Screenshots/Logs
[Add screenshots or console logs]
```

---

## 💡 Feature Requests

### Feature Request Template

```markdown
## Feature Description
Clear description of the proposed feature

## Problem It Solves
What user need does this address?

## Proposed Solution
How would you implement it?

## Alternatives Considered
Other approaches you've thought about

## Additional Context
Screenshots, mockups, or examples
```

---

## 🚨 Security

**Never commit**:
- API keys or secrets
- `google-services.json`
- `config.js` (use `config.example.js`)
- Passwords or tokens
- Private keys or certificates

**If you accidentally commit sensitive data**:
1. **Immediately** rotate the compromised keys
2. Contact the project admin
3. Remove from Git history (if needed)

---

## 📞 Questions?

- **General questions**: Open a discussion on GitHub
- **Bug reports**: Create an issue
- **Urgent matters**: Contact project admin directly

---

## 🎉 Thank You!

Every contribution, no matter how small, makes ReplacePlace better. We appreciate your effort and collaboration!

**Happy coding!** 🚀
