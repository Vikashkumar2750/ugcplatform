const{createClient}=require('@supabase/supabase-js');
const s=createClient('https://efrxmkidupynwmnqhcfx.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmcnhta2lkdXB5bndtbnFoY2Z4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTg4MDc4MCwiZXhwIjoyMDk1NDU2NzgwfQ.7nGLIXLbYLZZ1q9VYQaeroOnG8ElpRz97Myt1dVF1Zs');

(async()=>{
  console.log('=== RECENT WEBHOOK EVENTS (last 20) ===');
  const{data:events}=await s.from('webhook_events').select('event_type,sender_id,payload,created_at').order('created_at',{ascending:false}).limit(20);
  for(const e of events||[]){
    const p=e.payload;
    const text=p?.message?.text||p?.postback?.title||'none';
    const pbPayload=p?.postback?.payload||'none';
    const qr=p?.message?.quick_reply?.payload||'none';
    const isMsg=!!p?.message;
    const isPB=!!p?.postback;
    const t=new Date(e.created_at).toLocaleTimeString();
    console.log(`[${t}] ${e.event_type} from=${e.sender_id} isMsg=${isMsg} isPB=${isPB} text="${String(text).substring(0,50)}" pb=${pbPayload} qr=${qr}`);
  }

  console.log('\n=== MESSAGE QUEUE (last 15) ===');
  const{data:q}=await s.from('message_queue').select('status,message_type,recipient_id,message_payload,error,created_at,sent_at').order('created_at',{ascending:false}).limit(15);
  for(const m of q||[]){
    const t=new Date(m.created_at).toLocaleTimeString();
    const txt=m.message_payload?.text?.substring(0,60)||'none';
    const hasLink=!!m.message_payload?.link;
    const hasPB=!!m.message_payload?.postback_button;
    const hasQR=!!(m.message_payload?.quick_replies?.length);
    console.log(`[${t}] ${m.status} | ${m.message_type} | to=${String(m.recipient_id).substring(0,20)} | "${txt}" link=${hasLink} pb=${hasPB} qr=${hasQR} err=${m.error||'OK'}`);
  }

  console.log('\n=== DM CONVERSATIONS (recent) ===');
  const{data:dm}=await s.from('dm_conversations').select('sender_id,message_count,last_message_at,opted_out').order('last_message_at',{ascending:false}).limit(5);
  for(const d of dm||[]){
    console.log(`sender=${d.sender_id} count=${d.message_count} last=${d.last_message_at} opted=${d.opted_out}`);
  }
})();
