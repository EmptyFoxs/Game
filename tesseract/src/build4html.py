import json, base64, os
eng = open('engine4.js').read()
lv = json.load(open('levels4.json'))
ship = [[{k:v for k,v in l.items() if k not in ('sol','rot')} for l in c] for c in lv]
import subprocess
story = json.loads(subprocess.check_output(['node','-e',"const s=require('./story.js');console.log(JSON.stringify({chapters:s.chapters,quips:s.quips,finale:s.finale}))"]))
files = {
 'robot/Robot.glb': '/home/claude/dl4/Robot.glb', 'fox/Fox.glb': '/home/claude/dl4/Fox.glb',
 'kenney/character.glb': '/home/claude/game3d/models/character.glb', 'kenney/cloud.glb': '/home/claude/game3d/models/cloud.glb',
 'kenney/grass.glb': '/home/claude/game3d/models/grass.glb', 'kenney/Textures/colormap.png': '/home/claude/game3d/models/Textures/colormap.png',
 'fps/enemy-flying.glb': '/home/claude/dl/Starter-Kit-FPS/models/enemy-flying.glb', 'fps/Textures/colormap.png': '/home/claude/dl/Starter-Kit-FPS/models/Textures/colormap.png'}
A = {}
for k, p in files.items():
    mime = 'model/gltf-binary' if p.endswith('.glb') else 'image/png'
    A[k] = 'data:%s;base64,%s' % (mime, base64.b64encode(open(p,'rb').read()).decode())
s = open('src4.html').read()
s = s.replace('/*ENGINE*/', eng).replace('/*LEVELS*/', json.dumps(ship, ensure_ascii=False)).replace('/*STORY*/', json.dumps(story, ensure_ascii=False)).replace('/*ASSETS*/', json.dumps(A))
os.makedirs('/home/claude/dist4d', exist_ok=True); open('/home/claude/dist4d/index.html','w').write(s)
print(len(s)//1024, 'KB', sum(len(c) for c in lv), 'levels')
