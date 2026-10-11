# Outputs from modules

# Outputs from modules - Hybrid Style

# ============================================
# COMMON SERVERS Outputs (Dynamic)
# ============================================
output "common_servers_summary" {
  description = "Summary of all common servers"
  value = {
    for name, server in module.common_ec2 : name => {
      instance_id    = server.instance_id
      public_ip      = server.public_ip
      private_ip     = server.private_ip
      public_dns     = server.public_dns
      ssh_command    = server.ssh_command
      instance_url   = server.instance_url
      security_group = module.common_sg[name].security_group_id
    }
  }
}

output "common_servers_public_ips" {
  description = "Public IPs of all common servers"
  value       = { for k, v in module.common_ec2 : k => v.public_ip }
}

output "common_servers_ssh_commands" {
  description = "SSH commands for all common servers"
  value       = { for k, v in module.common_ec2 : k => v.ssh_command }
}

# ============================================
# SPECIAL SERVER - Kong API Gateway Outputs
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
# ALL SERVERS Summary
# ============================================
output "all_servers" {
  description = "Summary of all servers (special + common)"
  value = {
    # Special servers
    kong_api_gateway = {
      instance_id = module.kong_ec2.instance_id
      public_ip   = module.kong_ec2.public_ip
      private_ip  = module.kong_ec2.private_ip
      ssh         = module.kong_ec2.ssh_command
      url         = module.kong_ec2.instance_url
      type        = "special"
    }

    # Common servers (dynamically added)
    common_servers = {
      for name, server in module.common_ec2 : name => {
        instance_id = server.instance_id
        public_ip   = server.public_ip
        private_ip  = server.private_ip
        ssh         = server.ssh_command
        url         = server.instance_url
        type        = "common"
      }
    }
  }
}
