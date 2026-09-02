$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

#region Variables
$spotifierFolderPath = "$env:LOCALAPPDATA\spotifier"
$spotifierOldFolderPath = "$HOME\spotifier-cli"
#endregion Variables

#region Functions
function Write-Success {
  [CmdletBinding()]
  param ()
  process {
    Write-Host -Object ' > OK' -ForegroundColor 'Green'
  }
}

function Write-Unsuccess {
  [CmdletBinding()]
  param ()
  process {
    Write-Host -Object ' > ERROR' -ForegroundColor 'Red'
  }
}

function Test-Admin {
  [CmdletBinding()]
  param ()
  begin {
    Write-Host -Object "Checking if the script is not being run as administrator..." -NoNewline
  }
  process {
    $currentUser = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    -not $currentUser.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  }
}

function Test-PowerShellVersion {
  [CmdletBinding()]
  param ()
  begin {
    $PSMinVersion = [version]'5.1'
  }
  process {
    Write-Host -Object 'Checking if your PowerShell version is compatible...' -NoNewline
    $PSVersionTable.PSVersion -ge $PSMinVersion
  }
}

function Move-OldSpotifierFolder {
  [CmdletBinding()]
  param ()
  process {
    if (Test-Path -Path $spotifierOldFolderPath) {
      Write-Host -Object 'Moving the old spotifier folder...' -NoNewline
      Copy-Item -Path "$spotifierOldFolderPath\*" -Destination $spotifierFolderPath -Recurse -Force
      Remove-Item -Path $spotifierOldFolderPath -Recurse -Force
      Write-Success
    }
  }
}

function Get-Spotifier {
  [CmdletBinding()]
  param ()
  begin {
    if ($env:PROCESSOR_ARCHITECTURE -eq 'AMD64') {
      $architecture = 'x64'
    }
    elseif ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') {
      $architecture = 'arm64'
    }
    else {
      $architecture = 'x32'
    }
    if ($v) {
      if ($v -match '^\d+\.\d+\.\d+$') {
        $targetVersion = $v
      }
      else {
        Write-Warning -Message "You have specified an invalid spotifier version: $v `nThe version must be in the following format: 1.2.3"
        Pause
        exit
      }
    }
    else {
      Write-Host -Object 'Fetching the latest spotifier version...' -NoNewline
      $latestRelease = Invoke-RestMethod -Uri 'https://api.github.com/repos/picoskids/Spotifier/releases/latest'
      $targetVersion = $latestRelease.tag_name -replace 'v', ''
      Write-Success
    }
    $archivePath = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "spotifier.zip")
  }
  process {
    Write-Host -Object "Downloading spotifier v$targetVersion..." -NoNewline
    $Parameters = @{
      Uri            = "https://github.com/picoskids/Spotifier/releases/download/v$targetVersion/spotifier-$targetVersion-windows-$architecture.zip"
      UseBasicParsin = $true
      OutFile        = $archivePath
    }
    Invoke-WebRequest @Parameters
    Write-Success
  }
  end {
    $archivePath
  }
}

function Add-SpotifierToPath {
  [CmdletBinding()]
  param ()
  begin {
    Write-Host -Object 'Making spotifier available in the PATH...' -NoNewline
    $user = [EnvironmentVariableTarget]::User
    $path = [Environment]::GetEnvironmentVariable('PATH', $user)
  }
  process {
    $path = $path -replace "$([regex]::Escape($spotifierOldFolderPath))\\*;*", ''
    if ($path -notlike "*$spotifierFolderPath*") {
      $path = "$path;$spotifierFolderPath"
    }
  }
  end {
    [Environment]::SetEnvironmentVariable('PATH', $path, $user)
    if (($env:PATH -split ';') -notcontains $spotifierFolderPath) {
      $env:PATH = "$env:PATH;$spotifierFolderPath"
    }
    Write-Success
  }
}

function Install-Spotifier {
  [CmdletBinding()]
  param ()
  begin {
    Write-Host -Object 'Installing spotifier...'
  }
  process {
    $archivePath = Get-Spotifier
    Write-Host -Object 'Extracting spotifier...' -NoNewline
    Expand-Archive -Path $archivePath -DestinationPath $spotifierFolderPath -Force
    Write-Success
    Add-SpotifierToPath
  }
  end {
    Remove-Item -Path $archivePath -Force -ErrorAction 'SilentlyContinue'
    Write-Host -Object 'spotifier was successfully installed!' -ForegroundColor 'Green'
  }
}
#endregion Functions

#region Main
#region Checks
if (-not (Test-PowerShellVersion)) {
  Write-Unsuccess
  Write-Warning -Message 'PowerShell 5.1 or higher is required to run this script'
  Write-Warning -Message "You are running PowerShell $($PSVersionTable.PSVersion)"
  Write-Host -Object 'PowerShell 5.1 install guide:'
  Write-Host -Object 'https://learn.microsoft.com/skypeforbusiness/set-up-your-computer-for-windows-powershell/download-and-install-windows-powershell-5-1'
  Write-Host -Object 'PowerShell 7 install guide:'
  Write-Host -Object 'https://learn.microsoft.com/powershell/scripting/install/installing-powershell-on-windows'
  Pause
  exit
}
else {
  Write-Success
}
if (-not (Test-Admin)) {
  Write-Unsuccess
  Write-Warning -Message "The script was run as administrator. This can result in problems with the installation process or unexpected behavior. Do not continue if you do not know what you are doing."
  $Host.UI.RawUI.Flushinputbuffer()
  $choices = [System.Management.Automation.Host.ChoiceDescription[]] @(
    (New-Object System.Management.Automation.Host.ChoiceDescription '&Yes', 'Abort installation.'),
    (New-Object System.Management.Automation.Host.ChoiceDescription '&No', 'Resume installation.')
  )
  $choice = $Host.UI.PromptForChoice('', 'Do you want to abort the installation process?', $choices, 0)
  if ($choice -eq 0) {
    Write-Host -Object 'spotifier installation aborted' -ForegroundColor 'Yellow'
    Pause
    exit
  }
}
else {
  Write-Success
}
#endregion Checks

#region Spotifier
Move-OldSpotifierFolder
Install-Spotifier
Write-Host -Object "`nRun" -NoNewline
Write-Host -Object ' spotifier -h ' -NoNewline -ForegroundColor 'Cyan'
Write-Host -Object 'to get started'
#endregion Spotifier

#region Marketplace
$Host.UI.RawUI.Flushinputbuffer()
$choices = [System.Management.Automation.Host.ChoiceDescription[]] @(
    (New-Object System.Management.Automation.Host.ChoiceDescription "&Yes", "Install Spotifier Marketplace."),
    (New-Object System.Management.Automation.Host.ChoiceDescription "&No", "Do not install Spotifier Marketplace.")
)
$choice = $Host.UI.PromptForChoice('', "`nDo you also want to install Spotifier Marketplace? It will become available within the Spotify client, where you can easily install themes and extensions.", $choices, 0)
if ($choice -eq 1) {
  Write-Host -Object 'spotifier Marketplace installation aborted' -ForegroundColor 'Yellow'
}
else {
  Write-Host -Object 'Starting the spotifier Marketplace installation script..'
  $Parameters = @{
    Uri             = 'https://raw.githubusercontent.com/spotifier/spotifier-marketplace/main/resources/install.ps1'
    UseBasicParsing = $true
  }
  Invoke-WebRequest @Parameters | Invoke-Expression
}
#endregion Marketplace

#region Autostart
$Host.UI.RawUI.Flushinputbuffer()
$choices = [System.Management.Automation.Host.ChoiceDescription[]] @(
    (New-Object System.Management.Automation.Host.ChoiceDescription "&Yes", "Enable autostart."),
    (New-Object System.Management.Automation.Host.ChoiceDescription "&No", "Do not enable autostart.")
)
$choice = $Host.UI.PromptForChoice('', "`nAlso re-apply spotifier automatically every time you log in? Without this, a Spotify update or PC restart can silently undo your customization until you rerun 'spotifier apply' yourself.", $choices, 0)
if ($choice -eq 0) {
  & "$spotifierFolderPath\spotifier.exe" autostart enable
}
#endregion Autostart
#endregion Main
