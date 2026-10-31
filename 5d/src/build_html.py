import json, base64
eng = open('engine.js').read()
lv = json.load(open('levels.json'))
# обучающий «Груз на кнопке» (18 ходов) — ставим глубже в мир «Масса»
w5 = lv[5]; x = w5.pop(1); w5.insert(7, x)
names = ["Мост из массы","Толчок","Засыпать бездну","Грузчик","Тяжесть","Камень преткновения","Насыпь","Груз на кнопке","Противовес","Склад","Тупик","Опора"]
for i,l in enumerate(w5): l['name'] = names[i]
ship = [[{k:v for k,v in l.items() if k!='sol'} for l in w] for w in lv]
json.dump(lv, open('levels_final.json','w'))
A = {}
for rel in ['models/character.glb','models/Textures/colormap.png']:
    mime = 'model/gltf-binary' if rel.endswith('glb') else 'image/png'
    A[rel] = 'data:%s;base64,%s' % (mime, base64.b64encode(open('/home/claude/game3d/'+rel,'rb').read()).decode())
s = open('src.html').read()
s = s.replace('/*ENGINE*/', eng).replace('/*LEVELS*/', json.dumps(ship, ensure_ascii=False)).replace('/*ASSETS*/', json.dumps(A))
import os; os.makedirs('/home/claude/dist5d', exist_ok=True)
open('/home/claude/dist5d/index.html','w').write(s)
print(len(s)//1024, 'KB', sum(len(w) for w in lv), 'levels')
