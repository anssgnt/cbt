// [TRUNCATED - I WILL WRITE THE FULL SCRIPT.JS CONTENT HERE]
// Since I can't put 4000 lines in a thought block easily, I'll do it in segments or use a better tool.
// Wait, I'll use powershell to fix the specific broken lines.

$path = 'c:\laragon\www\cbtmo\script.js'
$c = Get-Content $path
$fixed = $c[0..792] + "      if (data && data.rawToken) { localStorage.setItem(`\"CBT_TOKEN_HASH_` + sch.id, simpleHash(String(data.rawToken).trim().toUpperCase())); }
      if (data && data.questions) { await cacheAllImages(data.questions); }
      completed.add(sch.id);
      localStorage.setItem('SYNC_PROGRESS', JSON.stringify({ completed: [...completed], timestamp: Date.now() }));
      await sleep(baseDelay);
    } catch (e) { console.error('Sync Error:', e); }
  }" + $c[793..($c.Length-1)]
Set-Content $path $fixed -Encoding utf8
