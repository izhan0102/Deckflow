# Troubleshooting Guide

This guide covers common installation, testing, and runtime issues encountered while working with DeckFlow.

---

# 1. Installation Issues

## Problem: `pip install deckflow` fails

### Possible Causes

* Unsupported Python version
* Outdated pip
* Network issues

### Solution

Check Python version:

```bash
python --version
```

DeckFlow requires Python 3.9 or later.

Upgrade pip:

```bash
python -m pip install --upgrade pip
```

Install dependencies again:

```bash
pip install -r requirements.txt
```

---

# 2. Module Not Found Error

## Error

```text
ModuleNotFoundError: No module named 'deckflow'
```

### Solution

Verify installation:

```bash
pip show deckflow
```

If not installed:

```bash
pip install deckflow
```

If using a virtual environment:

```bash
source venv/bin/activate
```

or on Windows:

```bash
venv\Scripts\activate
```

---

# 3. PPTX File Cannot Be Opened

## Error

```text
PackageNotFoundError
```

### Possible Causes

* Invalid file path
* Corrupted PPTX file
* Unsupported file format

### Solution

Verify file exists:

```python
from pathlib import Path

print(Path("presentation.pptx").exists())
```

Ensure the file is a valid `.pptx` presentation.

---

# 4. Unable to Access Slide Content

## Error

```text
AttributeError
```

### Possible Causes

* Incorrect slide index
* Missing chart, table, or text element

### Solution

Inspect available content:

```python
slide = deck.get_slide(1)
slide.list_content()
```

Verify element names before accessing them.

---

# 5. Chart Update Fails

## Error

```text
KeyError
```

### Possible Causes

* Invalid chart name
* Missing series data

### Solution

Check chart names first:

```python
slide.list_content()
```

Validate update payload structure:

```python
{
    "categories": [...],
    "series": {
        "Series 1": [...]
    }
}
```

---

# 6. Table Update Issues

## Problem

Table content is not updated correctly.

### Solution

Verify row/column orientation:

```python
slide.update_table(
    "TableName",
    data,
    by_rows=True,
    by_columns=False
)
```

Use only one orientation mode at a time.

---

# 7. Save Operation Fails

## Error

```text
PermissionError
```

### Possible Causes

* PPTX file already open in PowerPoint
* Insufficient file permissions

### Solution

Close the presentation before saving.

Save using a different output filename:

```python
deck.save("updated_presentation.pptx")
```

---

# 8. Test Failures

## Problem

Tests fail locally but pass elsewhere.

### Solution

Create a clean virtual environment:

```bash
python -m venv venv
```

Activate it and reinstall dependencies:

```bash
pip install -e .
```

Run tests again:

```bash
pytest
```

---

# 9. CI/CD Pipeline Failures

## Possible Causes

* Python version mismatch
* Missing dependency
* Failed test cases

### Solution

Verify CI uses supported Python versions:

```yaml
python-version: "3.9"
```

Run locally before pushing:

```bash
pytest
```

---

# 10. Debugging Tips

Enable detailed traceback:

```bash
pytest -v
```

Check installed packages:

```bash
pip list
```

Verify environment:

```bash
python --version
pip --version
```

---

# Frequently Asked Questions

### Does DeckFlow support .ppt files?

No. Convert `.ppt` files to `.pptx` before use.

### What Python versions are supported?

Python 3.9 and above.

### Why are slide elements not found?

Use:

```python
slide.list_content()
```

to inspect available content names before accessing them.

---

# Additional Resources

* README.md
* CONTRIBUTING.md
* python-pptx Documentation
* Project Issues Page

If your issue is not listed here, please open a GitHub issue with:

* Python version
* Operating system
* Full error traceback
* Steps to reproduce
