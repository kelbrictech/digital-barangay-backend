const prisma = require('../config/prisma');
const asyncHandler = require('../utils/asyncHandler');
const { isValidRequestTransition, isValidConcernTransition } = require('../utils/stateMachine');
const { auditData } = require('../utils/audit');

const USER_SELECT = { id:true, fullName:true, email:true, role:true, address:true, contactNumber:true, createdAt:true, staffId:true, accountStatus:true };
const clean = (obj, keys) => Object.fromEntries(keys.filter(k => obj && obj[k] !== undefined).map(k => [k, obj[k]]));

const getUsers = asyncHandler(async (req,res) => {
  const { search='', page=1, limit=20 } = req.query;
  const where = search ? { OR:[{fullName:{contains:search,mode:'insensitive'}},{email:{contains:search,mode:'insensitive'}}] } : {};
  const [users,total] = await Promise.all([
    prisma.user.findMany({where,select:USER_SELECT,skip:(page-1)*Number(limit),take:Number(limit),orderBy:{createdAt:'desc'}}),
    prisma.user.count({where}),
  ]);
  res.json({success:true,total,page:Number(page),users});
});

const updateUser = asyncHandler(async (req,res) => {
  const protectedFields=['role','staffId','accountStatus'];
  if (protectedFields.some(f => Object.prototype.hasOwnProperty.call(req.body||{},f))) return res.status(403).json({success:false,message:'Administrative credential fields can only be changed through the Webmaster workflow.'});
  const existing = await prisma.user.findUnique({where:{id:req.params.id},select:USER_SELECT});
  if (!existing) return res.status(404).json({success:false,message:'User not found'});
  const data=clean(req.body,['fullName','address','contactNumber']);
  const [user] = await prisma.$transaction([
    prisma.user.update({where:{id:existing.id},data,select:USER_SELECT}),
    prisma.auditEvent.create({data:auditData(req,{module:'residents',action:'updated',recordId:existing.id,recordLabel:existing.fullName,before:clean(existing,Object.keys(data)),after:data})}),
  ]);
  res.json({success:true,user});
});

const getAllRequests = asyncHandler(async (req,res) => {
  const where={}; if(req.query.status)where.status=req.query.status;if(req.query.documentType)where.documentType=req.query.documentType;
  const requests=await prisma.documentRequest.findMany({where,include:{requestor:{select:{fullName:true,email:true}}},orderBy:{createdAt:'desc'}});
  res.json({success:true,count:requests.length,requests});
});

const updateRequestStatus = asyncHandler(async (req,res) => {
  const {status,note}=req.body;
  const existing=await prisma.documentRequest.findUnique({where:{id:req.params.id}});
  if(!existing)return res.status(404).json({success:false,message:'Request not found'});
  if(!isValidRequestTransition('admin',existing.status,status))return res.status(400).json({success:false,message:`Cannot move a request from "${existing.status}" to "${status}".`});
  if(existing.status==='under_review'&&status==='rejected'&&!String(note||'').trim())return res.status(400).json({success:false,message:'A reason is required when rejecting a request.'});
  const [request]=await prisma.$transaction([
    prisma.documentRequest.update({where:{id:existing.id},data:{status}}),
    prisma.requestStatusHistory.create({data:{requestId:existing.id,fromStatus:existing.status,toStatus:status,actorUserId:req.user.id,actorType:'admin',actorStaffId:req.user.staffId||null,note:note||null}}),
    prisma.auditEvent.create({data:auditData(req,{module:'requests',action:'status_changed',recordId:existing.id,recordLabel:existing.trackingNumber||existing.documentType,before:{status:existing.status},after:{status},note})}),
  ]);
  res.json({success:true,request});
});

const createOfficial = asyncHandler(async (req,res) => {
  const official=await prisma.$transaction(async tx=>{const row=await tx.official.create({data:req.body});await tx.auditEvent.create({data:auditData(req,{module:'officials',action:'created',recordId:row.id,recordLabel:row.name,after:row})});return row;});
  res.status(201).json({success:true,official});
});
const updateOfficial = asyncHandler(async (req,res) => {
  const existing=await prisma.official.findUnique({where:{id:req.params.id}});if(!existing)return res.status(404).json({success:false,message:'Official not found'});
  const official=await prisma.$transaction(async tx=>{const row=await tx.official.update({where:{id:existing.id},data:req.body});await tx.auditEvent.create({data:auditData(req,{module:'officials',action:'updated',recordId:row.id,recordLabel:row.name,before:existing,after:row})});return row;});res.json({success:true,official});
});
const deleteOfficial = asyncHandler(async (req,res) => {
  const existing=await prisma.official.findUnique({where:{id:req.params.id}});if(!existing)return res.status(404).json({success:false,message:'Official not found'});
  await prisma.$transaction([prisma.auditEvent.create({data:auditData(req,{module:'officials',action:'deleted',recordId:existing.id,recordLabel:existing.name,before:existing})}),prisma.official.delete({where:{id:existing.id}})]);res.json({success:true,message:'Official removed'});
});

const createNotice = asyncHandler(async (req,res) => {
  const notice=await prisma.$transaction(async tx=>{const row=await tx.notice.create({data:{...req.body,postedById:req.user.id}});await tx.auditEvent.create({data:auditData(req,{module:'notices',action:'created',recordId:row.id,recordLabel:row.title,after:row})});return row;});res.status(201).json({success:true,notice});
});
const updateNotice = asyncHandler(async (req,res) => {
  const existing=await prisma.notice.findUnique({where:{id:req.params.id}});if(!existing)return res.status(404).json({success:false,message:'Notice not found'});
  const notice=await prisma.$transaction(async tx=>{const row=await tx.notice.update({where:{id:existing.id},data:req.body});await tx.auditEvent.create({data:auditData(req,{module:'notices',action:'updated',recordId:row.id,recordLabel:row.title,before:existing,after:row})});return row;});res.json({success:true,notice});
});
const deleteNotice = asyncHandler(async (req,res) => {
  const existing=await prisma.notice.findUnique({where:{id:req.params.id}});if(!existing)return res.status(404).json({success:false,message:'Notice not found'});
  await prisma.$transaction([prisma.auditEvent.create({data:auditData(req,{module:'notices',action:'deleted',recordId:existing.id,recordLabel:existing.title,before:existing})}),prisma.notice.delete({where:{id:existing.id}})]);res.json({success:true,message:'Notice removed'});
});

const getAllConcerns = asyncHandler(async (req,res) => {
  const where={};if(req.query.status)where.status=req.query.status;
  const concerns=await prisma.concern.findMany({where,include:{reporter:{select:{fullName:true,email:true}}},orderBy:{createdAt:'desc'}});res.json({success:true,count:concerns.length,concerns});
});
const updateConcernStatus = asyncHandler(async (req,res) => {
  const {status,note}=req.body;const existing=await prisma.concern.findUnique({where:{id:req.params.id}});if(!existing)return res.status(404).json({success:false,message:'Concern not found'});
  if(!isValidConcernTransition('admin',existing.status,status))return res.status(400).json({success:false,message:`Cannot move a concern from "${existing.status}" to "${status}".`});
  const [concern]=await prisma.$transaction([
    prisma.concern.update({where:{id:existing.id},data:{status}}),
    prisma.concernStatusHistory.create({data:{concernId:existing.id,fromStatus:existing.status,toStatus:status,actorUserId:req.user.id,actorType:'admin',actorStaffId:req.user.staffId||null,note:note||null}}),
    prisma.auditEvent.create({data:auditData(req,{module:'concerns',action:'status_changed',recordId:existing.id,recordLabel:existing.category,before:{status:existing.status},after:{status},note})}),
  ]);res.json({success:true,concern});
});

function legacyAction(h){
  if(/^Imported from (?:VICO|Digital Barangay)/.test(String(h.note||''))) return 'imported_state';
  return h.fromStatus===null?'created':'status_changed';
}

function legacyEventToShared(h,module,recordId,recordLabel){
  const actorName=h.actor?.fullName || (h.actorType==='system'?'System':h.actorType);
  return {
    id:`legacy:${h.id}`,actorUserId:h.actorUserId||null,actorName,actorStaffId:h.actorStaffId||null,actorType:h.actorType,
    module,action:legacyAction(h),recordId,recordLabel,
    before:h.fromStatus===null?null:{status:h.fromStatus},after:{status:h.toStatus},note:h.note||null,createdAt:h.createdAt,legacy:true,
  };
}

function sameLogicalHistoryEvent(a,b){
  if(a.module!==b.module||a.recordId!==b.recordId)return false;
  const actionsEquivalent=a.action===b.action || ([a.action,b.action].includes('created')&&[a.action,b.action].every(x=>x==='created'));
  if(!actionsEquivalent)return false;
  if(a.actorUserId&&b.actorUserId&&a.actorUserId!==b.actorUserId)return false;
  if(Math.abs(new Date(a.createdAt)-new Date(b.createdAt))>5000)return false;
  const aBefore=a.before?.status??null,bBefore=b.before?.status??null;
  const aAfter=a.after?.status??null,bAfter=b.after?.status??null;
  return aBefore===bBefore&&aAfter===bAfter;
}

function dedupeEvents(events){
  const ordered=[...events].sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
  const deduped=[];
  for(const event of ordered){
    const duplicate=deduped.some(existing=>sameLogicalHistoryEvent(existing,event));
    if(!duplicate)deduped.push(event);
  }
  return deduped;
}

const getActivity = asyncHandler(async (req,res) => {
  const end=req.query.end?new Date(req.query.end):new Date();
  const start=req.query.start?new Date(req.query.start):new Date(end.getTime()-24*60*60*1000);
  if(Number.isNaN(start.getTime())||Number.isNaN(end.getTime())||start>end)return res.status(400).json({success:false,message:'Invalid activity date range.'});
  if(end-start>90*24*60*60*1000)return res.status(400).json({success:false,message:'Custom activity searches are limited to 90 days. Please narrow the date range.'});

  const dateWhere={gte:start,lte:end};
  const [auditEvents,requestHistory,concernHistory,admins]=await Promise.all([
    prisma.auditEvent.findMany({where:{createdAt:dateWhere},orderBy:{createdAt:'asc'}}),
    prisma.requestStatusHistory.findMany({
      where:{createdAt:dateWhere},
      include:{actor:{select:{fullName:true}},request:{select:{trackingNumber:true,documentType:true}}},
      orderBy:{createdAt:'asc'},
    }),
    prisma.concernStatusHistory.findMany({
      where:{createdAt:dateWhere},
      include:{actor:{select:{fullName:true}},concern:{select:{category:true}}},
      orderBy:{createdAt:'asc'},
    }),
    prisma.user.findMany({where:{role:'admin'},select:{id:true,fullName:true,staffId:true},orderBy:{fullName:'asc'}}),
  ]);

  const legacyRequests=requestHistory.map(h=>legacyEventToShared(h,'requests',h.requestId,h.request?.trackingNumber||h.request?.documentType||'Request'));
  const legacyConcerns=concernHistory.map(h=>legacyEventToShared(h,'concerns',h.concernId,h.concern?.category||'Concern'));
  const allEvents=dedupeEvents([...legacyRequests,...legacyConcerns,...auditEvents]);

  const modules=[...new Set(allEvents.map(x=>x.module).filter(Boolean))].sort();
  const actions=[...new Set(allEvents.map(x=>x.action).filter(Boolean))].sort();
  let filtered=allEvents;
  if(req.query.actorUserId)filtered=filtered.filter(x=>x.actorUserId===req.query.actorUserId);
  if(req.query.module)filtered=filtered.filter(x=>x.module===req.query.module);
  if(req.query.action)filtered=filtered.filter(x=>x.action===req.query.action);

  filtered.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const total=filtered.length;
  const events=filtered.slice(0,500);
  res.json({
    success:true,count:events.length,total,truncated:total>events.length,events,
    sources:{audit:auditEvents.length,legacyRequest:requestHistory.length,legacyConcern:concernHistory.length},
    filters:{admins,modules,actions},
  });
});

const getRecordHistory = asyncHandler(async (req,res) => {
  const {module,recordId}=req.params;
  const auditEvents=await prisma.auditEvent.findMany({where:{module,recordId},orderBy:{createdAt:'asc'}});
  let legacy=[];
  if(module==='requests'){
    const request=await prisma.documentRequest.findUnique({where:{id:recordId},select:{trackingNumber:true,documentType:true}});
    const rows=await prisma.requestStatusHistory.findMany({where:{requestId:recordId},include:{actor:{select:{fullName:true}}},orderBy:{createdAt:'asc'}});
    legacy=rows.map(h=>legacyEventToShared(h,module,recordId,request?.trackingNumber||request?.documentType||'Request'));
  } else if(module==='concerns'){
    const concern=await prisma.concern.findUnique({where:{id:recordId},select:{category:true}});
    const rows=await prisma.concernStatusHistory.findMany({where:{concernId:recordId},include:{actor:{select:{fullName:true}}},orderBy:{createdAt:'asc'}});
    legacy=rows.map(h=>legacyEventToShared(h,module,recordId,concern?.category||'Concern'));
  }
  const deduped=dedupeEvents([...legacy,...auditEvents]);
  res.json({success:true,count:deduped.length,events:deduped});
});

const getReportsSummary = asyncHandler(async (req,res) => {
  const [requestsByStatus,requestsByType,concernsByStatus,totalUsers]=await Promise.all([prisma.documentRequest.groupBy({by:['status'],_count:{_all:true}}),prisma.documentRequest.groupBy({by:['documentType'],_count:{_all:true}}),prisma.concern.groupBy({by:['status'],_count:{_all:true}}),prisma.user.count({where:{role:'resident'}})]);
  res.json({success:true,summary:{totalUsers,requestsByStatus:requestsByStatus.map(r=>({_id:r.status,count:r._count._all})),requestsByType:requestsByType.map(r=>({_id:r.documentType,count:r._count._all})),concernsByStatus:concernsByStatus.map(r=>({_id:r.status,count:r._count._all}))}});
});

module.exports={getUsers,updateUser,getAllRequests,updateRequestStatus,createOfficial,updateOfficial,deleteOfficial,createNotice,updateNotice,deleteNotice,getAllConcerns,updateConcernStatus,getActivity,getRecordHistory,getReportsSummary};
