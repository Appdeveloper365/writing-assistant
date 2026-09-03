"use strict";(()=>{var e=document.getElementById("root");if(e){e.innerHTML=`
    <div style="font-family: sans-serif; padding: 20px; max-width: 400px;">
      <h2>Writing Assistant</h2>
      <p>Outlook add-in shell for the shared writing assistant core.</p>
      <button id="rewrite">Rewrite selected text</button>
      <div id="result" style="margin-top: 16px;"></div>
    </div>
  `;let n=document.getElementById("rewrite"),t=document.getElementById("result");n?.addEventListener("click",async()=>{let i="This draft could be made clearer and more professional.";t&&(t.textContent=`Preview: ${i}`)})}})();
