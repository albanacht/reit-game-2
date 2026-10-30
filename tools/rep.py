"""rep.py: safe find-and-replace for the game's files (refuses to shrink a file by half)."""
def rep(path, a, b, n=1):
    with open(path) as f: s = f.read()
    if a not in s: raise SystemExit('NOT FOUND in ' + path + ': ' + a[:90])
    s2 = s.replace(a, b, n)
    if len(s2) < len(s) * 0.5: raise SystemExit('refusing: file would shrink too much')
    with open(path, 'w') as f: f.write(s2)
