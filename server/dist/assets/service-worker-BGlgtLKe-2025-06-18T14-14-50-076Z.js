self.addEventListener("push",function(t){if(t.data){const i=t.data.json();if(i.type==="check")return;t.waitUntil(self.registration.showNotification(i.title||"New Message",{body:i.message,icon:"/notification-icon.png",badge:"/notification-badge.png",data:i}))}});
//# sourceMappingURL=service-worker-BGlgtLKe-2025-06-18T14-14-50-076Z.js.map
