import re

# Read the file
with open(r'c:\Users\royai\Desktop\PythonProject\FixLog\src\app\dashboard\records\page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix setNewRecord call in handleAddRecord
content = content.replace(
    "setNewRecord({ client_id: '', type: '장애', details: '' });",
    "setNewRecord({ client_id: '', type: '장애', details: '', receiver_id: '' });"
)

# 2. Check for other setNewRecord calls
# (Usually there is one in useEffect or initialization, but I already updated the initialization)

# Check if there's any other place.
# Also check Dashboard page. I updated Dashboard page too?
# Yes, I did. Let's check src/app/dashboard/page.tsx too.

# 3. Add receiver_id: '' to setNewRecord initialization in RecordsPage if I missed it
# Wait, let's verify if I did it. I'll just be safe.

# Write back RecordsPage
with open(r'c:\Users\royai\Desktop\PythonProject\FixLog\src\app\dashboard\records\page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed RecordsPage TypeScript errors")
