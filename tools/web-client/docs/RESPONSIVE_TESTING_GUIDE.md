# Responsive Design Testing Guide

Complete testing guide for responsive design implementation with manual, automated, and device testing procedures.

## Manual Testing Procedures

### 1. Chrome DevTools Browser Testing

#### Setup
1. Open Chrome DevTools: `F12` or `Cmd+Option+I`
2. Click "Toggle device toolbar" button or press `Ctrl+Shift+M` (Cmd+Shift+M on Mac)
3. You'll see device selector dropdown

#### Test Device Profiles

| Device | Width | Breakpoint | Notes |
|--------|-------|-----------|-------|
| iPhone SE | 375px | sm | Smallest common phone |
| iPhone 12 | 390px | sm | Common mobile size |
| iPhone 12 Pro Max | 428px | sm | Large phone |
| iPad Mini | 768px | md | Smallest tablet |
| iPad Air | 820px | md | Mid-size tablet |
| iPad Pro | 1024px | lg | Large tablet |
| Desktop (1280) | 1280px | xl | Common desktop |
| Desktop (1920) | 1920px | xl | Large desktop |

#### Testing Steps

1. **Mobile (375-428px)**
   - [ ] Navigation drawer appears as hamburger menu
   - [ ] Modals display as full-screen drawer
   - [ ] Buttons are 44x44px or larger
   - [ ] Text is readable without horizontal scroll
   - [ ] Forms stack vertically
   - [ ] Images scale to fit width

2. **Tablet (768-820px)**
   - [ ] Navigation becomes visible (based on design)
   - [ ] Modals may show as drawer or dialog
   - [ ] Multi-column layouts have 2 columns
   - [ ] Buttons responsive to touch
   - [ ] Content has adequate padding

3. **Desktop (1024px+)**
   - [ ] Navigation sidebar visible
   - [ ] Modals display as centered dialog
   - [ ] Multi-column layouts have 3+ columns
   - [ ] Normal mouse-sized buttons (40x40px)
   - [ ] Full-width content with max constraints

### 2. Touch Simulation Testing

#### Enable Touch Simulation
1. Open DevTools
2. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
3. Type "Enable touch simulation"
4. Select the option

#### Test Touch Interactions
- [ ] Long press menu items (no drag-to-select)
- [ ] Swipe down on drawer to close
- [ ] Tap buttons without gap (44px spacing)
- [ ] Pinch to zoom (if enabled)
- [ ] Scroll momentum works smoothly

### 3. Orientation Testing

#### Landscape Mode
1. Open DevTools device toolbar
2. Click orientation button to rotate
3. Test at landscape width (usually wider)

**Test Cases:**
- [ ] Layout adapts to landscape
- [ ] No horizontal scroll needed
- [ ] Controls still touch-friendly
- [ ] Drawer still functional
- [ ] Modal still visible

#### Portrait Mode
- [ ] Revert to portrait
- [ ] Verify all portrait features work
- [ ] No layout shift
- [ ] Smooth transition

## Automated Testing

### Unit Tests

Run responsive utilities tests:
```bash
npm run test -- use-media-query.test.ts
npm run test -- responsive-utils.test.ts
```

### Test Coverage Goals

- [x] Media query hooks (100% coverage)
- [x] Responsive utilities (100% coverage)
- [x] Swipe detection logic (100% coverage)
- [x] Breakpoint detection (100% coverage)

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- use-media-query.test.ts

# Run with coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

## Device-Specific Testing

### iPhone Testing

#### iPhone SE (375px)
- [ ] Smallest supported iPhone width
- [ ] Check hamburger menu appears
- [ ] Verify drawer takes full width
- [ ] No horizontal scrolling
- [ ] Touch targets 44px minimum

#### iPhone 12 (390px)
- [ ] Standard mobile viewport
- [ ] Navigation drawer functional
- [ ] Modal as drawer
- [ ] Smooth animations
- [ ] Safe area respected (notch)

#### iPhone 12 Pro Max (428px)
- [ ] Largest mobile width
- [ ] Check if still mobile layout
- [ ] Wide content handling
- [ ] Multi-line text rendering

### iPad Testing

#### iPad Mini (768px)
- [ ] Exact md breakpoint
- [ ] May show tablet or mobile layout
- [ ] Touch gestures work
- [ ] Drawer optional (can be split-view)

#### iPad Air (820px)
- [ ] Tablet-specific features
- [ ] Multi-column layout
- [ ] Drawer vs sidebar navigation
- [ ] Content margins appropriate

#### iPad Pro (1024px)
- [ ] lg breakpoint active
- [ ] Desktop-like layout
- [ ] Sidebar navigation
- [ ] Dialog modals
- [ ] 3-column grids

### Real Device Testing

#### Setup
1. Open DevTools
2. Go to Sources tab
3. In left panel, find "Devices"
4. Click "Settings" (gear icon)
5. Enable port forwarding
6. Forward port 3000 to localhost:3000

#### Testing on Real iPhone
1. Connect iPhone to computer
2. Open browser to `http://localhost:3000`
3. Enable Safari DevTools (Develop > [Device Name])
4. Test all interactions

#### Testing on Real iPad
Same as iPhone, verify larger screen handling

## Responsive Component Testing

### ResponsiveModal Testing

**Mobile < 768px:**
- [ ] Renders as Drawer
- [ ] Slides from bottom
- [ ] Swipe down closes it
- [ ] Dark overlay visible
- [ ] No escape possible (swipe only)

**Desktop >= 768px:**
- [ ] Renders as Dialog
- [ ] Centered on screen
- [ ] Click outside closes it
- [ ] ESC key closes it
- [ ] Modal overlay present

**Transition:**
- [ ] Resize window slowly
- [ ] Modal switches smoothly
- [ ] No console errors
- [ ] Scroll position preserved

### Drawer Testing

**Swipe Gesture:**
- [ ] Swipe down 50px+ closes
- [ ] Swipe down <50px snaps back
- [ ] Visual feedback during swipe
- [ ] Smooth animation
- [ ] No flicker

**Click Outside:**
- [ ] Click overlay closes
- [ ] Click content doesn't close
- [ ] Click X button closes
- [ ] ESC key closes

**Accessibility:**
- [ ] Tab navigation works
- [ ] Focus visible on buttons
- [ ] Screen reader announces content
- [ ] Keyboard ESC works

### Mobile Nav Drawer Testing

**Toggle Button:**
- [ ] Visible only on mobile (<768px)
- [ ] 44x44px size or larger
- [ ] Clickable from anywhere
- [ ] Visual feedback on click

**Menu Items:**
- [ ] Each item 44px minimum height
- [ ] Icons render correctly
- [ ] Badges show correctly
- [ ] Hover state visible
- [ ] Click navigates

**Auto-Close:**
- [ ] Menu closes after navigation
- [ ] No double-click needed
- [ ] Page scrolls to top
- [ ] Active item highlighted

## Performance Testing

### Lighthouse Audit

1. Open DevTools
2. Click "Lighthouse" tab
3. Select "Mobile" for mobile testing
4. Click "Analyze page load"

**Target Scores:**
- Performance: 85+
- Accessibility: 90+
- Best Practices: 85+
- SEO: 90+

**Check for:**
- [ ] No layout shift when responsive
- [ ] Smooth animations (60 FPS)
- [ ] Media queries execute quickly
- [ ] Touch targets properly sized

### Performance Metrics

Test with DevTools Performance tab:

1. Start recording
2. Interact with responsive features
3. Resize window
4. Stop recording

**Check:**
- [ ] No dropped frames
- [ ] Quick event handlers
- [ ] Smooth animations
- [ ] No memory leaks

## Accessibility Testing

### Keyboard Navigation

- [ ] Tab through all controls
- [ ] Shift+Tab goes backward
- [ ] Enter activates buttons
- [ ] Space activates buttons
- [ ] ESC closes modals
- [ ] Arrow keys work in menus

### Screen Reader Testing

**Using NVDA (Windows):**
1. Download NVDA (free)
2. Enable in Windows accessibility
3. Navigate with arrow keys
4. Verify all text announced

**Using JAWS (Windows):**
1. Enable JAWS if available
2. Use arrow keys to navigate
3. Check aria-labels announced

**Using VoiceOver (Mac):**
1. Cmd+F5 to enable
2. Use VO+arrow keys
3. Verify content announced

### Testing Checklist

- [ ] All buttons have labels
- [ ] Modals have titles
- [ ] Links have text
- [ ] Images have alt text
- [ ] Form fields labeled
- [ ] Focus order logical
- [ ] Color not only indicator
- [ ] Sufficient contrast

## Touch Target Testing

### Measurement in DevTools

1. Open DevTools Inspector
2. Click element to inspect
3. Check computed size in rightPanel

**Expected Sizes:**
- Buttons: 44x44px minimum
- Links: 44x44px minimum
- Menu items: 44px height minimum
- Checkboxes: 44x44px minimum
- Inputs: 44px height minimum

### Visual Verification

1. Enable device toolbar
2. Enable touch simulation
3. Try to tap each button
4. Should feel natural and easy

## Network Throttling Testing

### Simulate Slow Networks

1. Open DevTools Network tab
2. Select throttling from dropdown:
   - Slow 3G
   - Fast 3G
   - 4G
   - WiFi

**Test Cases:**
- [ ] Page loads on Slow 3G
- [ ] Images lazy-load (if enabled)
- [ ] Text readable before images
- [ ] Interactions still responsive
- [ ] No timeout on navigation

## Viewport Meta Tag Testing

Verify in HTML `<head>`:
```html
<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0"
/>
```

**Test:**
- [ ] Page zooms to fit width
- [ ] No horizontal scroll
- [ ] Pinch-zoom works
- [ ] Double-tap zoom works

## CSS Media Query Testing

### Override for Testing

Add to styles temporarily:
```css
/* Show breakpoint indicator */
body::before {
  content: 'Mobile';
  position: fixed;
  top: 0;
  left: 0;
  background: red;
  color: white;
  padding: 10px;
  z-index: 9999;
}

@media (min-width: 768px) {
  body::before {
    content: 'Tablet';
    background: orange;
  }
}

@media (min-width: 1024px) {
  body::before {
    content: 'Desktop';
    background: green;
  }
}
```

## Common Issues & Solutions

### Issue: Modal doesn't switch to drawer on mobile

**Debug:**
1. Check media query in DevTools
2. Verify breakpoint value
3. Check component imports
4. Clear cache and reload

**Solution:**
```typescript
// Add console logging
const isDesktop = useMediaQuery(`(min-width: ${BREAKPOINTS.md}px)`);
console.log('isDesktop:', isDesktop); // Should log changes
```

### Issue: Touch targets too small

**Debug:**
1. Inspect element in DevTools
2. Check computed height/width
3. Look for padding/margin classes

**Solution:**
```typescript
// Should be at least 44px
<button className="h-11 w-11 md:h-10 md:w-10">
  Touch friendly
</button>
```

### Issue: Drawer swipe doesn't work

**Debug:**
1. Check touch simulation enabled
2. Verify swipe is 50px+ threshold
3. Check event listeners in DevTools

**Solution:**
```typescript
// Check BREAKPOINTS value
console.log(BREAKPOINTS.md); // Should be 768
```

### Issue: Horizontal scroll on mobile

**Debug:**
1. Open DevTools Device Mode
2. Check element overflow
3. Measure against viewport width

**Solution:**
- Use `overflow-x-hidden`
- Set max-width on containers
- Use responsive padding

## Testing Checklist

### Pre-Launch

- [ ] All components build without errors
- [ ] TypeScript compilation passes
- [ ] All tests pass
- [ ] No console warnings
- [ ] Lighthouse scores acceptable

### Mobile Testing

- [ ] Tested on iPhone SE (375px)
- [ ] Tested on iPhone 12 (390px)
- [ ] Tested on device simulator
- [ ] Touch interactions smooth
- [ ] No horizontal scroll
- [ ] Safe area respected

### Tablet Testing

- [ ] Tested on iPad (768px)
- [ ] Tested on iPad (820px)
- [ ] Landscape mode works
- [ ] Touch targets adequate
- [ ] Layout balanced

### Desktop Testing

- [ ] Tested on 1024px width
- [ ] Tested on 1920px width
- [ ] Tested on ultra-wide
- [ ] No layout shift
- [ ] Typography readable

### Accessibility Testing

- [ ] WCAG 2.5.5 targets verified
- [ ] Keyboard navigation complete
- [ ] Screen reader tested
- [ ] Color contrast checked
- [ ] Focus order correct

### Performance

- [ ] Lighthouse mobile 85+
- [ ] Lighthouse desktop 90+
- [ ] 60 FPS animations
- [ ] Fast 3G acceptable
- [ ] No memory leaks

### Documentation

- [ ] All files have comments
- [ ] README updated
- [ ] Examples provided
- [ ] Usage guide written
- [ ] Tests documented

## Quick Command Reference

```bash
# Run development server
npm run dev

# Run tests
npm test

# Type check
npm run typecheck

# Lint
npm run lint

# Build
npm run build

# Clean DevTools cache
# macOS: Cmd+Shift+Delete
# Windows: Ctrl+Shift+Delete
```

## Resources

- [Chrome DevTools](https://developer.chrome.com/docs/devtools/)
- [MDN Responsive Design](https://developer.mozilla.org/en-US/docs/Learn/CSS/CSS_layout/Responsive_Design)
- [WCAG 2.5.5 Target Size](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html)
- [Tailwind Responsive Design](https://tailwindcss.com/docs/responsive-design)
- [Web.dev Performance](https://web.dev/performance/)

## Support

For testing issues:
1. Check this guide first
2. Review responsive patterns guide
3. Check example implementations
4. File issue with specific device/breakpoint
