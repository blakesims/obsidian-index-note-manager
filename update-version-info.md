Taken from `~/Obsidian/mvp-wt/dev/whisper-gpu/.obsidian/plugins/summary-generator/new-version-instructions.md`

## Pushing a New Release

1. Update version numbers:
    ```
    - Update version in `manifest.json`
    - Update `versions.json` with new entry
    - Update version in `package.json` (if applicable)
    ```
    The package.json doesn't need to b updated - it mostly for node dependancies...
2. Commit changes:

    ```
    git add manifest.json versions.json package.json
    git commit -m "Bump version to x.y.z"
    ```

3. Create and push tag:

    ```
    git tag -a x.y.z -m "Version x.y.z"
    git push origin main
    git push origin x.y.z
    ```

4. Wait for GitHub Actions to complete.

5. Check GitHub Releases page for new release.

```

Replace `x.y.z` with your actual version number (e.g., 0.3.1).
See here for the full instructions:
https://publish.obsidian.md/hub/04+-+Guides%2C+Workflows%2C+%26+Courses/Guides/Using+GitHub+actions+to+create+releases+for+plugins
```
