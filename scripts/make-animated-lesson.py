#!/usr/bin/env python3
"""Superseded: the fall-prevention and hand-rehab animations are now drawn by scripts/motion/fall-rehab/
(the pycairo version lives in git history). This forwards to the new renderer so old commands never overwrite the
new videos with the old look.

  python3 scripts/make-animated-lesson.py --all                  # = scripts/motion/fall-rehab/render.py
  python3 scripts/make-animated-lesson.py fall-heel-raise-v1
"""
import os
import sys

new = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'motion/fall-rehab/render.py')
args = [a for a in sys.argv[1:] if a != '--all']
os.execvp('uv', ['uv', 'run', '--with', 'playwright', 'python', new, *args])
