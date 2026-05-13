require 'json'
begin
  exec("cd ios && pod install")
rescue => e
  puts e.backtrace
end
