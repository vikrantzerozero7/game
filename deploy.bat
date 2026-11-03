@echo off
git add .
git commit -m "update"
git branch -M main
git remote remove origin 2>nul
git remote add origin https://github.com/vikrantzerozero7/game.git
git push -u origin main