@REM Asset Management Mobile Backend Service
nssm.exe install "Asset Management Mobile Backend" "C:\Program Files\nodejs\node.exe" "D:\Asset-Management-Mobile-View\server.js"
nssm.exe set     "Asset Management Mobile Backend" Description "The Asset Management Mobile Backend allows users to view the qlik apps on mobile layout."
nssm.exe set     "Asset Management Mobile Backend" AppDirectory D:\Asset-Management-Mobile-View
nssm.exe set     "Asset Management Mobile Backend" AppStdout "D:\Asset-Management-Mobile-View\logs\out.txt"
nssm.exe set     "Asset Management Mobile Backend" AppStderr "D:\Asset-Management-Mobile-View\logs\err.txt"
nssm.exe set     "Asset Management Mobile Backend" AppRotateFiles 0
nssm.exe set     "Asset Management Mobile Backend" Start SERVICE_DELAYED_AUTO_START
nssm.exe start   "Asset Management Mobile Backend"