// Minimal serverless function for Vercel — mock purchase handler
// Accepts POST JSON and returns {status: 'ok'}. Replace with real payment or chain logic later.

export default async function handler(req, res){
  if(req.method !== 'POST'){
    res.status(405).json({error: 'Method Not Allowed'});
    return;
  }
  try{
    const body = req.body;
    // log / validate in real impl
    console.log('mock-purchase', body);
    // For demo, always succeed
    res.setHeader('Content-Type','application/json');
    res.status(200).json({status: 'ok', received: body});
  }catch(err){
    console.error(err);
    res.status(500).json({status:'error'});
  }
}
