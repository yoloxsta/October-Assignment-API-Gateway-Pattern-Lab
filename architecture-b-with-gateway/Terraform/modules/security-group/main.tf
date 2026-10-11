# Security Group Module - Creates a security group with dynamic ingress rules

resource "aws_security_group" "this" {
  name        = var.name
  description = var.description
  vpc_id      = var.vpc_id

  tags = merge(
    {
      Name = var.name
    },
    var.tags
  )
}

# Dynamic ingress rules for allowed ports
resource "aws_security_group_rule" "ingress" {
  count             = length(var.allowed_ports)
  type              = "ingress"
  from_port         = var.allowed_ports[count.index]
  to_port           = var.allowed_ports[count.index]
  protocol          = "tcp"
  cidr_blocks       = var.allowed_ports[count.index] == 22 ? [var.allowed_ssh_cidr] : ["0.0.0.0/0"]
  security_group_id = aws_security_group.this.id
}

# Egress rule (allow all outbound traffic)
resource "aws_security_group_rule" "egress" {
  type              = "egress"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.this.id
}
