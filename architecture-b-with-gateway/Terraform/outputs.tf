# Outputs from modules

# ============================================
# Kong API Gateway Outputs
# ============================================
output "kong_instance_id" {
  description = "ID of the Kong API Gateway EC2 instance"
  value       = module.kong_ec2.instance_id
}

output "kong_public_ip" {
  description = "Public IP address of the Kong API Gateway"
  value       = module.kong_ec2.public_ip
}

output "kong_private_ip" {
  description = "Private IP address of the Kong API Gateway"
  value       = module.kong_ec2.private_ip
}

output "kong_public_dns" {
  description = "Public DNS of the Kong API Gateway"
  value       = module.kong_ec2.public_dns
}

output "kong_security_group_id" {
  description = "ID of the Kong security group"
  value       = module.kong_sg.security_group_id
}

output "kong_ssh_command" {
  description = "SSH command to connect to Kong instance"
  value       = module.kong_ec2.ssh_command
}

output "kong_instance_url" {
  description = "Base URL of the Kong instance"
  value       = module.kong_ec2.instance_url
}

# ============================================
# Web Server Outputs - DISABLED
# ============================================
# output "web_instance_id" {
#   description = "ID of the Web Server EC2 instance"
#   value       = module.web_ec2.instance_id
# }
# 
# output "web_public_ip" {
#   description = "Public IP address of the Web Server"
#   value       = module.web_ec2.public_ip
# }
# 
# output "web_private_ip" {
#   description = "Private IP address of the Web Server"
#   value       = module.web_ec2.private_ip
# }
# 
# output "web_public_dns" {
#   description = "Public DNS of the Web Server"
#   value       = module.web_ec2.public_dns
# }
# 
# output "web_security_group_id" {
#   description = "ID of the Web Server security group"
#   value       = module.web_sg.security_group_id
# }
# 
# output "web_ssh_command" {
#   description = "SSH command to connect to Web Server"
#   value       = module.web_ec2.ssh_command
# }
# 
# output "web_instance_url" {
#   description = "Base URL of the Web Server instance"
#   value       = module.web_ec2.instance_url
# }

# ============================================
# Summary Output
# ============================================
output "all_servers" {
  description = "Summary of all servers"
  value = {
    kong_api_gateway = {
      instance_id = module.kong_ec2.instance_id
      public_ip   = module.kong_ec2.public_ip
      private_ip  = module.kong_ec2.private_ip
      ssh         = module.kong_ec2.ssh_command
      url         = module.kong_ec2.instance_url
    }
    # web_server = {
    #   instance_id = module.web_ec2.instance_id
    #   public_ip   = module.web_ec2.public_ip
    #   private_ip  = module.web_ec2.private_ip
    #   ssh         = module.web_ec2.ssh_command
    #   url         = module.web_ec2.instance_url
    # }
  }
}
