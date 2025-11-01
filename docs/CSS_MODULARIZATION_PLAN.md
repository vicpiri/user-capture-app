# CSS Modularization Plan

## Current Status

The main `styles.css` file has **1999 lines**, which makes it difficult to maintain and navigate. This document outlines a complete plan to modularize the CSS into logical, maintainable modules.

## Completed (Quick Win - Option A)

- [x] Extract modal styles (~800 lines) to `styles/modals.css`
- [x] Keep remaining styles in `styles.css` temporarily
- [x] Update `index.html` to import both files

**Result**: Main CSS file reduced from 1999 to ~1200 lines

## Full Modularization Plan (Future Implementation)

### Proposed Module Structure

```
src/renderer/styles/
├── main.css              # Main entry point that imports all modules
├── base.css              # Reset, global styles, typography (✓ Created)
├── layout.css            # Container, panels, grid layout (✓ Created)
├── forms.css             # Input controls, selects, checkboxes (✓ Created)
├── tables.css            # User table and table-related styles
├── buttons.css           # All button styles and variants
├── modals.css            # All modal styles (✓ Created)
├── components.css        # Reusable UI components
└── utilities.css         # Scrollbars, animations, helpers
```

### Detailed Breakdown

#### 1. **base.css** (15 lines) ✓
- CSS reset (`*` selector)
- Body styles
- Global typography
- **Status**: Created

#### 2. **layout.css** (400 lines) ✓
- `.container` - Main container
- `.left-panel` - Left panel layout
- `.right-panel` - Right panel layout
- `.panel-header` - Panel headers
- `.panel-footer` - Panel footers
- `.table-container` - Table container
- `.image-container` - Image display area
- `.no-project-placeholder` - Empty state
- `.statusbar` - Status bar at bottom
- Alert badges and containers
- Loading spinners
- Animations (`@keyframes`)
- **Status**: Created

#### 3. **forms.css** (200 lines) ✓
- `.search-bar` - Search input and container
- `.group-filter` - Group dropdown
- `.checkbox-label` - Checkbox styles
- `.form-group` - Form groups
- `.form-control` - Input/select base styles
- `.form-help` - Help text
- Select dropdowns with custom arrow
- **Status**: Created

#### 4. **tables.css** (~300 lines)
**Lines**: 147-443 in current styles.css
- `.user-table` - Main user table
- Table headers (`thead`, `th`)
- Table rows and cells (`tbody`, `tr`, `td`)
- `.hide-photos-column` - Column visibility
- Photo indicators (`.photo-indicator`, `.photo-indicator-wrapper`)
- Repository indicators
- Status indicators:
  - `.card-print-indicator`
  - `.publication-indicator`
  - `.orla-paid-indicator`
  - `.receipt-printed-indicator`
- Lazy loading indicators
- Placeholder styles
- **Status**: Not created

#### 5. **buttons.css** (~100 lines)
**Lines**: 705-790 in current styles.css
- `.btn` - Base button styles
- `.btn-primary` - Primary button variant
- `.btn-secondary` - Secondary button variant
- `.btn-danger` - Danger button variant
- `.action-buttons` - Button container
- `.nav-button` - Image navigation buttons
- Additional action buttons
- **Status**: Not created

#### 6. **modals.css** (~800 lines) ✓
**Lines**: 790-1999 in current styles.css
- **Base modal** (`.modal`, `.modal-content`)
- **Specific modals**:
  - New Project Modal
  - Confirm Modal
  - Info Modal
  - Export Options Modal
  - User Image Preview Modal
  - Tagged Images Modal
  - Orla Export Modal
  - Inventory Export Modal
  - About Modal
  - Printer Configuration Modal (deprecated)
  - Receipt Configuration Modal (deprecated)
  - Restore Backup Modal
  - Preferences Modal (new sidebar layout)
- Progress bars
- Context menus
- Custom scrollbars for modals
- **Status**: Created

#### 7. **components.css** (~150 lines)
- Image tags (`.image-tags`)
- Image counter
- Selection mode styles
- Checkbox column
- Other reusable UI components
- **Status**: Not created

#### 8. **utilities.css** (~50 lines)
**Lines**: Scattered throughout current styles.css
- Custom scrollbars (`::-webkit-scrollbar`)
- Helper classes
- Utility animations
- Z-index management
- **Status**: Not created

### Module Dependencies

```
main.css
├── base.css (no dependencies)
├── layout.css (depends on: base.css)
├── forms.css (depends on: base.css)
├── tables.css (depends on: base.css, layout.css)
├── buttons.css (depends on: base.css)
├── components.css (depends on: base.css, layout.css)
├── modals.css (depends on: base.css, forms.css, buttons.css)
└── utilities.css (no dependencies)
```

### Implementation Steps (Future)

#### Phase 1: Extract Remaining Core Modules
1. Create `tables.css` by extracting lines 147-443
2. Create `buttons.css` by extracting lines 705-790
3. Create `components.css` by extracting image tags, selection mode, etc.
4. Create `utilities.css` by extracting scrollbar styles and helpers

#### Phase 2: Create Main Entry Point
1. Create `main.css` that imports all modules in correct order:
   ```css
   /* Base styles first */
   @import './styles/base.css';

   /* Layout and structure */
   @import './styles/layout.css';

   /* Form controls */
   @import './styles/forms.css';

   /* Tables */
   @import './styles/tables.css';

   /* Buttons */
   @import './styles/buttons.css';

   /* Components */
   @import './styles/components.css';

   /* Modals */
   @import './styles/modals.css';

   /* Utilities last */
   @import './styles/utilities.css';
   ```

#### Phase 3: Update HTML Files
1. Update `index.html` to use `main.css` instead of `styles.css`
2. Update other HTML files (camera.html, image-grid.html, etc.) if needed
3. Remove old `styles.css` file

#### Phase 4: Testing
1. Test main application functionality
2. Test all modals
3. Test all forms and inputs
4. Test table interactions
5. Test responsive behavior
6. Verify no visual regressions

### Benefits of Full Modularization

1. **Maintainability**: Easier to find and edit specific styles
2. **Reusability**: Modules can be shared across different pages
3. **Performance**: Browser can cache individual modules
4. **Collaboration**: Multiple developers can work on different modules
5. **Testing**: Easier to isolate and test specific UI components
6. **Documentation**: Each module is self-documenting
7. **Scalability**: Easy to add new modules as app grows

### Line Count Comparison

**Current**:
- `styles.css`: 1999 lines

**After Full Modularization**:
- `base.css`: ~15 lines
- `layout.css`: ~400 lines
- `forms.css`: ~200 lines
- `tables.css`: ~300 lines
- `buttons.css`: ~100 lines
- `components.css`: ~150 lines
- `modals.css`: ~800 lines
- `utilities.css`: ~50 lines
- `main.css`: ~10 lines (imports only)
- **Total**: ~2025 lines (similar, but much better organized)

**Largest files**:
- `modals.css` (800 lines) - Could be further split per modal if needed
- `layout.css` (400 lines) - Well organized by section
- `tables.css` (300 lines) - Single responsibility

### Notes

- The total line count stays roughly the same, but organization improves dramatically
- No functionality changes, only file reorganization
- All existing classes and selectors remain unchanged
- CSS specificity and cascade order must be preserved

### Future Enhancements

After completing the modularization, consider:

1. **CSS Variables**: Extract colors and spacing to CSS custom properties
2. **Per-Modal Files**: Split `modals.css` into individual modal files
3. **Component Library**: Create a living style guide/component library
4. **CSS Preprocessor**: Consider SCSS/SASS for variables and mixins
5. **CSS-in-JS**: Evaluate for component-specific styles

### Migration Checklist

When ready to implement:

- [ ] Create all CSS module files
- [ ] Extract content from `styles.css` to respective modules
- [ ] Create `main.css` with imports
- [ ] Update `index.html` and other HTML files
- [ ] Test all pages and modals
- [ ] Verify no visual regressions
- [ ] Update documentation
- [ ] Remove old `styles.css`
- [ ] Commit changes

---

**Document Version**: 1.0
**Last Updated**: 2025-11-01
**Status**: Planning phase - Quick win (modals extraction) completed
