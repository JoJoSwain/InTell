Pod::Spec.new do |s|
  s.name           = 'intell-storage'
  s.version        = '0.0.0'
  s.summary        = 'Backed-up progress directory and excluded asset directories'
  s.description    = 'Local Expo module for the M5a backup split'
  s.author         = ''
  s.homepage       = 'https://github.com/JoJoSwain/InTell'
  s.platforms      = { :ios => '16.4', :tvos => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
