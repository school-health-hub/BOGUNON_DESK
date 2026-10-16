// CI launcher only. Restrict the caller's own token; never edit policy or ACLs.
using System;
using System.Collections;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.Text;
public static class FinanceQaMediumProcess {
 [StructLayout(LayoutKind.Sequential)] struct SidAttributes { public IntPtr Sid; public uint Attributes; }
 [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] struct StartupInfo {
  public int cb; public string reserved, desktop, title;
  public uint x,y,xSize,ySize,xChars,yChars,fill,flags; public ushort show,reservedSize;
  public IntPtr reservedPtr,input,output,error;
 }
 [StructLayout(LayoutKind.Sequential)] struct ProcessInfo { public IntPtr process,thread; public uint pid,tid; }
 [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
 [DllImport("kernel32.dll")] static extern IntPtr LocalFree(IntPtr p);
 [DllImport("kernel32.dll",SetLastError=true)] static extern uint ResumeThread(IntPtr h);
 [DllImport("kernel32.dll")] static extern bool TerminateProcess(IntPtr h,uint code);
 [DllImport("advapi32.dll",SetLastError=true)] static extern bool OpenProcessToken(IntPtr process,uint access,out IntPtr token);
 [DllImport("advapi32.dll",SetLastError=true)] static extern bool CreateRestrictedToken(IntPtr token,uint flags,uint disableCount,[In] SidAttributes[] disable,uint deleteCount,IntPtr delete,uint restrictCount,IntPtr restrict,out IntPtr result);
 [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool ConvertStringSidToSid(string sid,out IntPtr result);
 [DllImport("advapi32.dll",SetLastError=true)] static extern uint GetLengthSid(IntPtr sid);
 [DllImport("advapi32.dll",SetLastError=true)] static extern bool SetTokenInformation(IntPtr token,int kind,IntPtr info,uint length);
 [DllImport("advapi32.dll",SetLastError=true)] static extern bool GetTokenInformation(IntPtr token,int kind,IntPtr info,uint length,out uint required);
 [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool CreateProcessWithTokenW(IntPtr token,uint logon,string app,StringBuilder command,uint flags,IntPtr environment,string directory,ref StartupInfo startup,out ProcessInfo process);
 static void Check(bool ok,string stage) { if(!ok) throw new Win32Exception(Marshal.GetLastWin32Error(),stage); }
 static IntPtr Query(IntPtr token,int kind) {
  uint length; GetTokenInformation(token,kind,IntPtr.Zero,0,out length);
  if(length==0) throw new Win32Exception(Marshal.GetLastWin32Error(),"Token query size");
  IntPtr p=Marshal.AllocHGlobal((int)length);
  try { Check(GetTokenInformation(token,kind,p,length,out length),"Token query"); return p; }
  catch { Marshal.FreeHGlobal(p); throw; }
 }
 static void Verify(IntPtr token,string expectedSid) {
  IntPtr user=Query(token,1), label=IntPtr.Zero, groups=IntPtr.Zero;
  try {
   if(new SecurityIdentifier(Marshal.ReadIntPtr(user)).Value!=expectedSid) throw new Exception("Wrong app user token");
   label=Query(token,25);
   if(new SecurityIdentifier(Marshal.ReadIntPtr(label)).Value!="S-1-16-8192") throw new Exception("App token must have Medium integrity");
   groups=Query(token,2);
   int count=Marshal.ReadInt32(groups), size=Marshal.SizeOf(typeof(SidAttributes));
   for(int i=0;i<count;i++) {
    var group=(SidAttributes)Marshal.PtrToStructure(IntPtr.Add(groups,(IntPtr.Size==8?8:4)+i*size),typeof(SidAttributes));
    if(new SecurityIdentifier(group.Sid).Value=="S-1-5-32-544" && (group.Attributes&4)!=0 && (group.Attributes&16)==0) throw new Exception("App token still has enabled Administrators group");
   }
  } finally { Marshal.FreeHGlobal(user); if(label!=IntPtr.Zero)Marshal.FreeHGlobal(label); if(groups!=IntPtr.Zero)Marshal.FreeHGlobal(groups); }
 }
 public static Process Start(string app,int port,string expectedSid) {
  if(port<1||port>65535) throw new ArgumentException("Invalid CDP port");
  if(WindowsIdentity.GetCurrent().User.Value!=expectedSid) throw new Exception("Wrong launcher user");
  IntPtr original=IntPtr.Zero, restricted=IntPtr.Zero, admin=IntPtr.Zero, power=IntPtr.Zero, medium=IntPtr.Zero, label=IntPtr.Zero, environment=IntPtr.Zero, childToken=IntPtr.Zero;
  ProcessInfo pi=new ProcessInfo(); Process child=null; bool resumed=false;
  try {
   Check(OpenProcessToken(GetCurrentProcess(),0x02000000,out original),"Open own token"); // MAXIMUM_ALLOWED on own token
   Check(ConvertStringSidToSid("S-1-5-32-544",out admin),"Administrators SID");
   Check(ConvertStringSidToSid("S-1-5-32-547",out power),"Power Users SID");
   Check(CreateRestrictedToken(original,1,2,new[]{new SidAttributes{Sid=admin},new SidAttributes{Sid=power}},0,IntPtr.Zero,0,IntPtr.Zero,out restricted),"Restrict own token");
   Check(ConvertStringSidToSid("S-1-16-8192",out medium),"Medium SID");
   uint labelSize=(uint)Marshal.SizeOf(typeof(SidAttributes))+GetLengthSid(medium);
   label=Marshal.AllocHGlobal((int)labelSize);
   Marshal.StructureToPtr(new SidAttributes{Sid=medium,Attributes=0x20},label,false);
   Check(SetTokenInformation(restricted,25,label,labelSize),"Set Medium integrity");
   Verify(restricted,expectedSid);
   var variables=new SortedDictionary<string,string>(StringComparer.OrdinalIgnoreCase);
   foreach(DictionaryEntry e in Environment.GetEnvironmentVariables()) variables[(string)e.Key]=(string)e.Value;
   variables["WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS"]="--remote-debugging-port="+port;
   var block=new StringBuilder(); foreach(var e in variables) block.Append(e.Key).Append('=').Append(e.Value).Append('\0'); block.Append('\0');
   environment=Marshal.StringToHGlobalUni(block.ToString());
   var startup=new StartupInfo{cb=Marshal.SizeOf(typeof(StartupInfo)),desktop="winsta0\\default"};
   // Start suspended, verify the ACTUAL child token, then allow any app code.
   Check(CreateProcessWithTokenW(restricted,1,app,new StringBuilder("\""+app+"\""),0x404,environment,System.IO.Path.GetDirectoryName(app),ref startup,out pi),"Create same-user Medium process");
   Check(OpenProcessToken(pi.process,8,out childToken),"Read child token");
   Verify(childToken,expectedSid);
   child=Process.GetProcessById((int)pi.pid);
   if(child.Handle==IntPtr.Zero) throw new Exception("Missing owned child handle");
   if(ResumeThread(pi.thread)==UInt32.MaxValue) throw new Win32Exception(Marshal.GetLastWin32Error(),"Resume verified child");
   resumed=true; return child;
  } finally {
   if(!resumed&&pi.process!=IntPtr.Zero) { TerminateProcess(pi.process,1); if(child!=null)child.Dispose(); }
   foreach(var h in new[]{childToken,pi.thread,pi.process,restricted,original}) if(h!=IntPtr.Zero)CloseHandle(h);
   foreach(var p in new[]{admin,power,medium}) if(p!=IntPtr.Zero)LocalFree(p);
   if(label!=IntPtr.Zero)Marshal.FreeHGlobal(label);
   if(environment!=IntPtr.Zero)Marshal.FreeHGlobal(environment);
  }
 }
}
