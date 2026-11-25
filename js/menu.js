(function () {
  const $ = id => document.getElementById(id);
  const num = k => { try { return Math.floor(+localStorage.getItem(k) || 0); } catch (e) { return 0; } };
  $('coinCount').textContent = num('dasgar_coins').toLocaleString();
  $('gemCount').textContent = num('dasgar_gems').toLocaleString();
  const pages = {
    shop: () => ['Shop', '<p>Skins and boosts are coming soon.</p>'],
    settings: () => ['Settings', '<p>Sound, graphics and control options are coming soon.</p>'],
    friends: () => ['Friends', '<p>Playing with friends is coming soon.</p>'],
    daily: () => ['Daily rewards', '<p>Daily missions and rewards are coming soon.</p>'],
    leaderboard: () => ['Leaderboard', '<p>Your best mass: <b>' + num('dasgar_best') + '</b></p><p>Online rankings will arrive with player accounts.</p>'],
    help: () => ['How to play', '<ul><li>Phone: touch anywhere and your cell heads there. Drag to steer like a joystick.</li><li>SPLIT launches half of your cell forward. FEED shoots a little mass.</li><li>Eat the small dots and smaller cells to grow. Bigger cells eat you.</li><li>Green spiky viruses burst big cells into pieces.</li><li>Computer: mouse to move, SPACE to split, W to feed, scroll to zoom.</li></ul>']
  };
  const open = k => { const p = pages[k](); $('modalTitle').textContent = p[0]; $('modalBody').innerHTML = p[1]; $('modal').classList.remove('hidden'); };
  document.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => open(b.dataset.open)));
  $('modalClose').onclick = () => $('modal').classList.add('hidden');
  $('modal').addEventListener('click', e => { if (e.target === $('modal')) $('modal').classList.add('hidden'); });
})();
