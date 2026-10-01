// Original schematic geography. These sectors are gameplay abstractions, not administrative boundaries.
export const outlines = {
  ukraine: [[166,353],[200,322],[221,282],[291,271],[316,288],[372,278],[403,294],[451,277],[485,289],[533,265],[557,227],[602,221],[626,237],[674,218],[698,247],[729,246],[748,276],[788,288],[815,304],[830,337],[872,328],[890,350],[938,354],[949,382],[987,396],[970,428],[956,464],[919,481],[921,517],[887,526],[865,563],[817,563],[788,584],[739,590],[714,610],[668,595],[638,611],[610,586],[568,600],[541,615],[500,593],[471,614],[445,598],[422,565],[393,566],[365,535],[331,547],[305,527],[270,545],[244,517],[211,527],[188,499],[149,480],[138,447],[157,420],[145,396]],
  crimea: [[628,644],[659,653],[680,642],[712,657],[753,658],[768,681],[743,704],[710,705],[681,732],[645,723],[631,697],[608,682]],
  belarus: [[295,114],[339,91],[394,102],[426,78],[484,92],[521,112],[565,101],[606,128],[635,158],[630,199],[660,218],[626,237],[602,221],[557,227],[533,265],[485,289],[451,277],[403,294],[372,278],[332,266],[323,225],[289,201],[304,173]],
  russia: [[660,218],[630,199],[635,158],[681,136],[693,91],[760,62],[817,79],[865,67],[910,88],[978,73],[1032,106],[1125,115],[1175,179],[1183,251],[1142,312],[1180,371],[1142,433],[1154,496],[1108,542],[1091,602],[1041,620],[1018,573],[980,546],[921,517],[919,481],[956,464],[970,428],[987,396],[949,382],[938,354],[890,350],[872,328],[830,337],[815,304],[788,288],[748,276],[729,246],[698,247],[674,218]]
};

// id, label, label center, geographic group, infrastructure, starting owner, force.
const rows = [
  ['volyn','Волинь',253,311,'ukraine','logistics','ua',24],
  ['rivne','Рівне',335,324,'ukraine','industry','ua',28],
  ['zhytomyr','Житомир',425,341,'ukraine','logistics','ua',30],
  ['kyiv','Київ',528,352,'ukraine','capital','ua',50],
  ['chernihiv','Чернігів',585,266,'ukraine','logistics','ua',54],
  ['sumy','Суми',693,290,'ukraine','industry','ua',54],
  ['lviv','Львів',212,401,'ukraine','industry','ua',65],
  ['ternopil','Тернопіль',284,407,'ukraine','logistics','ua',26],
  ['khmelnytskyi','Хмельницький',361,402,'ukraine','industry','ua',32],
  ['vinnytsia','Вінниця',435,438,'ukraine','logistics','ua',35],
  ['cherkasy','Черкаси',534,427,'ukraine','industry','ua',34],
  ['poltava','Полтава',638,378,'ukraine','logistics','ua',55],
  ['kharkiv','Харків',776,351,'ukraine','industry','ua',62],
  ['zakarpattia','Закарпаття',187,478,'ukraine','industry','ua',26],
  ['frankivsk','Франківськ',265,480,'ukraine','industry','ua',28],
  ['chernivtsi','Чернівці',336,505,'ukraine','logistics','ua',24],
  ['kropyvnytskyi','Кропивницький',540,504,'ukraine','logistics','ua',40],
  ['dnipro','Дніпро',673,466,'ukraine','industry','ua',78],
  ['luhansk','Луганськ',925,411,'ukraine','logistics','ru',60],
  ['donetsk','Донецьк',846,474,'ukraine','industry','ru',70],
  ['odesa','Одеса',440,550,'ukraine','port','ua',55],
  ['mykolaiv','Миколаїв',567,556,'ukraine','logistics','ua',65],
  ['kherson','Херсон',660,567,'ukraine','port','ru',46],
  ['zaporizhzhia','Запоріжжя',760,537,'ukraine','industry','ru',54],
  ['crimea','Крим',684,683,'crimea','port','ru',50],
  ['brest','Брест',361,207,'belarus','logistics','neutral',0],
  ['gomel','Гомель',532,176,'belarus','logistics','neutral',0],
  ['bryansk','Брянськ',720,180,'russia','logistics','ru',45],
  ['kursk','Курськ',795,247,'russia','industry','ru',45],
  ['belgorod','Бєлгород',860,310,'russia','logistics','ru',50],
  ['voronezh','Воронеж',976,246,'russia','fuel','ru',40],
  ['rostov','Ростов',1025,462,'russia','logistics','ru',60],
  ['krasnodar','Краснодар',1047,566,'russia','port','ru',40],
  ['rear','Промисловий тил',1040,145,'russia','capital','ru',65]
];

const links = [
  'volyn:rivne,lviv', 'rivne:lviv,ternopil,khmelnytskyi,zhytomyr',
  'zhytomyr:khmelnytskyi,vinnytsia,kyiv', 'kyiv:vinnytsia,cherkasy,poltava,chernihiv',
  'chernihiv:sumy,poltava,bryansk', 'sumy:poltava,kharkiv,kursk',
  'lviv:ternopil,frankivsk,zakarpattia', 'ternopil:khmelnytskyi,frankivsk,chernivtsi',
  'khmelnytskyi:vinnytsia,chernivtsi', 'vinnytsia:chernivtsi,cherkasy,kropyvnytskyi,odesa',
  'cherkasy:poltava,kropyvnytskyi,dnipro', 'poltava:kharkiv,dnipro',
  'kharkiv:dnipro,donetsk,luhansk,belgorod', 'zakarpattia:frankivsk',
  'frankivsk:chernivtsi', 'kropyvnytskyi:dnipro,mykolaiv,odesa',
  'dnipro:donetsk,zaporizhzhia,kherson,mykolaiv', 'luhansk:donetsk,belgorod,rostov',
  'donetsk:zaporizhzhia,rostov', 'odesa:mykolaiv', 'mykolaiv:kherson',
  'kherson:zaporizhzhia,crimea', 'zaporizhzhia:crimea', 'crimea:krasnodar',
  'bryansk:kursk,rear', 'kursk:belgorod,voronezh,rear', 'belgorod:voronezh,rostov',
  'voronezh:rostov,rear', 'rostov:krasnodar,rear', 'krasnodar:rear', 'brest:gomel'
];

export const REGIONS = rows.map(([id,name,x,y,geo,kind,owner,strength]) => ({id,name,x,y,geo,kind,owner,strength,neighbors:[]}));
export const BY_ID = Object.fromEntries(REGIONS.map(r => [r.id,r]));
for (const entry of links) {
  const [source, targets] = entry.split(':');
  for (const target of targets.split(',')) { BY_ID[source].neighbors.push(target); BY_ID[target].neighbors.push(source); }
}
export const UKRAINIAN = REGIONS.filter(r => ['ukraine','crimea'].includes(r.geo)).map(r => r.id);
export const KINDS = {capital:'Штаб і економіка',logistics:'Логістичний вузол',industry:'Виробничий центр',fuel:'Паливний вузол',port:'Порт'};
export const TECHS = {
  drones: {name:'Тактичні дрони',icon:'drone',cost:55,time:3,description:'Підтримка наступу: +18% до ефективності атак за рівень. РЕБ противника зменшує перевагу.'},
  strike: {name:'Далекі удари',icon:'target',cost:65,time:3,description:'Відкриває удари по тилу. Наступні рівні підвищують шкоду вузлам і послаблюють готовність гарнізону.'},
  defense: {name:'РЕБ і перехоплення',icon:'shield',cost:55,time:3,description:'Зменшує шкоду ударів по тилу та ефективність тактичних дронів противника.'},
  logistics: {name:'Логістика',icon:'route',cost:50,time:2,description:'+15 до місткості постачання за рівень. Підкріплення в дорозі швидші на один хід.'},
  naval: {name:'Морські системи',icon:'anchor',cost:50,time:3,description:'Посилює морські операції. Контроль сполучення відкриває дохід портів і покращує постачання.'}
};
export const SCENARIOS = {
  liberation: {name:'Повернення',tag:'36 тижнів · територіальна кампанія',turns:36,description:'Поверніть усі 25 українських секторів і втримайте їх два ходи. Бережіть Київ та готуйте резерви для наступу.'},
  defense: {name:'Тримати рубіж',tag:'20 тижнів · оборонна кампанія',turns:20,description:'Збережіть Київ і щонайменше 19 українських секторів до кінця 20-го тижня. Ворог розпочинає з посиленим фронтом.'}
};
export function clipHalfPlane(points, a, b, c) {
  const result=[];
  for(let i=0;i<points.length;i++) {
    const p=points[i], q=points[(i+1)%points.length];
    const dp=a*p[0]+b*p[1]-c, dq=a*q[0]+b*q[1]-c;
    if(dp<=0) result.push(p);
    if((dp<=0)!==(dq<=0)) { const t=dp/(dp-dq); result.push([p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])]); }
  }
  return result;
}
export function regionPolygon(region) {
  let points=outlines[region.geo];
  for(const other of REGIONS.filter(r=>r.geo===region.geo && r.id!==region.id)) {
    points=clipHalfPlane(points,2*(other.x-region.x),2*(other.y-region.y),other.x**2+other.y**2-region.x**2-region.y**2);
  }
  return points.map(p=>p.map(v=>v.toFixed(1)).join(',')).join(' ');
}
