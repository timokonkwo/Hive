(async()=>{
 const token=new URLSearchParams(location.hash.slice(1)).get('access');
 history.replaceState(null,'',location.pathname);
 if(!token){document.getElementById('access-status').textContent='Open the complete private link from the conversation.';return;}
 try{const response=await fetch('/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token}),cache:'no-store'});if(!response.ok)throw Error('This signing link has expired or is invalid.');location.reload();}
 catch(error){document.getElementById('access-status').textContent=error.message;}
})();
